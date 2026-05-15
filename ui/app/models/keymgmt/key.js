/**
 * Copyright IBM Corp. 2016, 2025
 * SPDX-License-Identifier: BUSL-1.1
 */

import Model, { attr } from '@ember-data/model';
import { expandAttributeMeta } from 'vault/utils/field-to-attrs';
import lazyCapabilities, { apiPath } from 'vault/macros/lazy-capabilities';
import { KeyManagementUpdateKeyRequestTypeEnum } from '@hashicorp/vault-client-typescript';

const KEY_TYPES = Object.values(KeyManagementUpdateKeyRequestTypeEnum);
export default class KeymgmtKeyModel extends Model {
  @attr('string', {
    label: 'Key name',
    subText: 'This is the name of the key that shows in Vault.',
  })
  name;

  @attr('string')
  backend;

  @attr('string', {
    subText: 'The type of cryptographic key that will be created.',
    possibleValues: KEY_TYPES,
    defaultValue: 'rsa-2048',
  })
  type;

  @attr('boolean', {
    label: 'Allow deletion',
    defaultValue: false,
  })
  deletionAllowed;

  @attr('number', {
    label: 'Current version',
  })
  latestVersion;

  @attr('number', {
    defaultValue: 0,
    defaultShown: 'All versions enabled',
  })
  minEnabledVersion;

  @attr('array')
  versions;

  // The following are calculated in serializer
  @attr('date')
  created;

  @attr('date', {
    defaultShown: 'Not yet rotated',
  })
  lastRotated;

  // The following are from endpoints other than the main read one
  @attr() provider; // string, or object with permissions error
  @attr() distribution;

  icon = 'key';

  get hasVersions() {
    return this.versions.length > 1;
  }

  get createFields() {
    const createFields = ['name', 'type', 'deletionAllowed'];
    return expandAttributeMeta(this, createFields);
  }

  get updateFields() {
    return expandAttributeMeta(this, ['minEnabledVersion', 'deletionAllowed']);
  }
  get showFields() {
    return expandAttributeMeta(this, [
      'name',
      'created',
      'type',
      'deletionAllowed',
      'latestVersion',
      'minEnabledVersion',
      'lastRotated',
    ]);
  }

  get keyTypeOptions() {
    return expandAttributeMeta(this, ['type'])[0];
  }

  get distFields() {
    return [
      {
        name: 'name',
        type: 'string',
        label: 'Distributed name',
        subText: 'The name given to the key by the provider.',
      },
      { name: 'purpose', type: 'string', label: 'Key Purpose' },
      { name: 'protection', type: 'string', subText: 'Where cryptographic operations are performed.' },
    ];
  }

  @lazyCapabilities(apiPath`${'backend'}/key/${'id'}`, 'backend', 'id') keyPath;
  @lazyCapabilities(apiPath`${'backend'}/key`, 'backend') keysPath;
  @lazyCapabilities(apiPath`${'backend'}/key/${'id'}/kms`, 'backend', 'id') keyProvidersPath;

  get canCreate() {
    return this.keyPath.get('canCreate');
  }
  get canDelete() {
    return this.keyPath.get('canDelete');
  }
  get canEdit() {
    return this.keyPath.get('canUpdate');
  }
  get canRead() {
    return this.keyPath.get('canRead');
  }
  get canList() {
    return this.keysPath.get('canList');
  }
  get canListProviders() {
    return this.keyProvidersPath.get('canList');
  }
}
