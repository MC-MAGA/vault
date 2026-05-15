/**
 * Copyright IBM Corp. 2016, 2025
 * SPDX-License-Identifier: BUSL-1.1
 */

import Component from '@glimmer/component';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { waitFor } from '@ember/test-waiters';
import { KeyManagementUpdateKeyRequestTypeEnum } from '@hashicorp/vault-client-typescript';

const KEY_TYPES = Object.values(KeyManagementUpdateKeyRequestTypeEnum);

/**
 * @module KeymgmtDistribute
 * KeymgmtDistribute components are used to provide a form to distribute Keymgmt keys to a provider.
 *
 * @example
 * ```js
 * <KeymgmtDistribute @backend="keymgmt" @key="my-key" @provider="my-kms" />
 * ```
 * @param {string} backend - name of backend, which will be the basis of other store queries
 * @param {string} [key] - key is the name of the existing key which is being distributed. Will hide the key field in UI
 * @param {string} [provider] - provider is the name of the existing provider which is being distributed to. Will hide the provider field in UI
 */

class DistributionData {
  @tracked key;
  @tracked provider;
  @tracked operations;
  @tracked protection;
}

const VALID_TYPES_BY_PROVIDER = {
  gcpckms: ['aes256-gcm96', 'rsa-2048', 'rsa-3072', 'rsa-4096', 'ecdsa-p256', 'ecdsa-p384', 'ecdsa-p521'],
  awskms: ['aes256-gcm96'],
  azurekeyvault: ['rsa-2048', 'rsa-3072', 'rsa-4096'],
};
export default class KeymgmtDistribute extends Component {
  @service store;
  @service api;
  @service flashMessages;
  @service router;

  @tracked keyModel;
  @tracked isNewKey = false;
  @tracked providerType;
  @tracked formData;
  @tracked formErrors;

  constructor() {
    super(...arguments);
    this.formData = new DistributionData();
    // Set initial values passed in
    this.formData.key = this.args.key || '';
    this.formData.provider = this.args.provider || '';
    // Side effects to get types of key or provider passed in
    if (this.args.provider) {
      this.getProviderType(this.args.provider);
    }
    if (this.args.key) {
      this.getKeyInfo(this.args.key);
    }
    this.formData.operations = [];
  }

  get keyTypes() {
    return KEY_TYPES;
  }

  get validMatchError() {
    if (!this.providerType || !this.keyModel?.type) {
      return null;
    }
    const valid = VALID_TYPES_BY_PROVIDER[this.providerType]?.includes(this.keyModel.type);
    if (valid) return null;

    // default to showing error on provider unless @provider (field hidden)
    if (this.args.provider) {
      return {
        key: `This key type is incompatible with the ${this.providerType} provider. To distribute to this provider, change the key type or choose another key.`,
      };
    }

    const message = `This provider is incompatible with the ${this.keyModel.type} key type. Please choose another provider`;
    return {
      provider: this.args.key ? `${message}.` : `${message} or change the key type.`,
    };
  }

  get operations() {
    const pt = this.providerType;
    if (pt === 'awskms') {
      return ['encrypt', 'decrypt'];
    } else if (pt === 'gcpckms') {
      const kt = this.keyModel?.type || '';
      switch (kt) {
        case 'aes256-gcm96':
          return ['encrypt', 'decrypt'];
        case 'rsa-2048':
        case 'rsa-3072':
        case 'rsa-4096':
          return ['decrypt', 'sign'];
        case 'ecdsa-p256':
        case 'ecdsa-p384':
          return ['sign'];
        default:
          return ['encrypt', 'decrypt', 'sign', 'verify', 'wrap', 'unwrap'];
      }
    }

    return ['encrypt', 'decrypt', 'sign', 'verify', 'wrap', 'unwrap'];
  }

  get disableOperations() {
    return (
      this.validMatchError ||
      !this.formData.provider ||
      !this.formData.key ||
      (this.isNewKey && !this.keyModel.type)
    );
  }

  async getKeyInfo(keyName, isNew = false) {
    if (isNew) {
      this.isNewKey = true;
      this.keyModel = {
        backend: this.args.backend,
        name: keyName,
        type: null,
      };
    } else {
      try {
        const { data } = await this.api.secrets.keyManagementReadKey(keyName, this.args.backend);
        this.keyModel = { ...data, name: keyName, backend: this.args.backend };
      } catch (error) {
        // Key type isn't essential for distributing, so if
        // we can't read it for some reason swallow the error
        // and allow the API to respond with any key/provider
        // type matching errors
        this.keyModel = null;
      }
    }
  }

  async getProviderType(id) {
    if (!id) {
      this.providerType = '';
      return;
    }

    const provider = await this.store
      .queryRecord('keymgmt/provider', {
        backend: this.args.backend,
        id,
      })
      .catch(() => {});
    this.providerType = provider?.provider;
  }

  destroyKey() {
    this.isNewKey = false;
    this.keyModel = null;
  }

  /**
   *
   * @param {DistributionData} rawData
   * @returns POJO formatted how the distribution endpoint needs
   */
  formatData(rawData) {
    const { key, provider, operations, protection } = rawData;
    if (!key || !provider || !operations || operations.length === 0) return null;
    return { key, provider, purpose: operations.join(','), protection };
  }

  async distributeKey(backend, data) {
    const { key, provider, purpose, protection } = data;
    try {
      await this.api.secrets.keyManagementDistributeKeyInKmsProvider(key, provider, backend, {
        purpose,
        protection,
      });
      this.flashMessages.success(`Successfully distributed key ${key} to ${provider}`);
      this.args.onClose();
    } catch (error) {
      const { message } = await this.api.parseError(error);
      this.formErrors = message;
    }
  }

  @action
  handleProvider(selection) {
    let providerName = selection[0];
    if (typeof selection === 'string') {
      // Handles case if no list permissions and fallback component is used
      providerName = selection;
    }
    this.formData.provider = providerName;
    if (providerName) {
      this.getProviderType(providerName);
    }
  }
  @action
  handleKeyType(evt) {
    if (this.keyModel) {
      this.keyModel = { ...this.keyModel, type: evt.target.value };
    }
  }

  @action
  handleOperation(evt) {
    const ops = [...this.formData.operations];
    if (evt.target.checked) {
      ops.push(evt.target.id);
    } else {
      const idx = ops.indexOf(evt.target.id);
      ops.splice(idx, 1);
    }
    this.formData.operations = ops;
  }

  @action
  async handleKeySelect(selected) {
    const selectedKey = selected[0] || null;
    if (!selectedKey) {
      this.formData.key = null;
      return this.destroyKey();
    }
    this.formData.key = selectedKey.id;
    return this.getKeyInfo(selectedKey.id, selectedKey.isNew);
  }

  @task
  @waitFor
  *createDistribution(evt) {
    evt.preventDefault();
    const { backend } = this.args;
    const data = this.formatData(this.formData);
    if (!data) {
      this.flashMessages.danger(`Key, provider, and operations are all required`);
      return;
    }
    if (this.isNewKey) {
      try {
        // Create the key first
        const keyData = { type: this.keyModel.type };
        yield this.api.secrets.keyManagementUpdateKey(this.keyModel.name, backend, keyData);
        this.flashMessages.success(`Successfully created key ${this.keyModel.name}`);
      } catch (error) {
        const { message } = yield this.api.parseError(error);
        this.flashMessages.danger(`Error creating new key ${this.keyModel.name}: ${message}`);
        return;
      }
    }
    yield this.distributeKey(backend, data);
  }
}
