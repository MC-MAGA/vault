/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: BUSL-1.1
 */

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, typeIn, fillIn } from '@ember/test-helpers';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { allowAllCapabilitiesStub, noopStub } from 'vault/tests/helpers/stubs';
import { GENERAL } from 'vault/tests/helpers/general-selectors';
import { MOUNT_BACKEND_FORM } from 'vault/tests/helpers/components/mount-backend-form-selectors';
import { mountBackend } from 'vault/tests/helpers/components/mount-backend-form-helpers';
import { ALL_ENGINES, filterEnginesByMountCategory } from 'vault/utils/all-engines-metadata';

import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';
import SecretsEngineForm from 'vault/forms/secrets/engine';
import AuthMethodForm from 'vault/forms/auth/method';

const WIF_ENGINES = ALL_ENGINES.filter((e) => e.isWIF).map((e) => e.type);

module('Integration | Component | mount backend form', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.flashMessages = this.owner.lookup('service:flash-messages');
    this.flashMessages.registerTypes(['success', 'danger']);
    this.flashSuccessSpy = sinon.spy(this.flashMessages, 'success');
    this.store = this.owner.lookup('service:store');
    this.server.post('/sys/capabilities-self', allowAllCapabilitiesStub());
    this.server.post('/sys/auth/foo', noopStub());
    this.server.post('/sys/mounts/foo', noopStub());
    this.onMountSuccess = sinon.spy();
  });

  module('auth method', function (hooks) {
    hooks.beforeEach(function () {
      const defaults = {
        config: { listing_visibility: false },
      };
      this.model = new AuthMethodForm(defaults, { isNew: true });
    });

    test('it renders default state', async function (assert) {
      assert.expect(15);
      await render(
        hbs`<MountBackendForm @mountCategory="auth" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      assert
        .dom(GENERAL.title)
        .hasText('Enable an Authentication Method', 'renders auth header in default state');

      for (const method of filterEnginesByMountCategory({
        mountCategory: 'auth',
        isEnterprise: false,
      }).filter((engine) => engine.type !== 'token')) {
        assert
          .dom(MOUNT_BACKEND_FORM.mountType(method.type))
          .hasText(method.displayName, `renders type:${method.displayName} picker`);
      }
    });

    test('it changes path when type is changed', async function (assert) {
      await render(
        hbs`<MountBackendForm @mountCategory="auth" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );

      await click(MOUNT_BACKEND_FORM.mountType('aws'));
      assert.dom(GENERAL.inputByAttr('path')).hasValue('aws', 'sets the value of the type');
      await click(GENERAL.backButton);
      await click(MOUNT_BACKEND_FORM.mountType('approle'));
      assert.dom(GENERAL.inputByAttr('path')).hasValue('approle', 'updates the value of the type');
    });

    test('it keeps path value if the user has changed it', async function (assert) {
      await render(
        hbs`<MountBackendForm @mountCategory="auth" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      await click(MOUNT_BACKEND_FORM.mountType('approle'));
      assert.strictEqual(this.model.type, 'approle', 'Updates type on model');
      assert.dom(GENERAL.inputByAttr('path')).hasValue('approle', 'defaults to approle (first in the list)');
      await fillIn(GENERAL.inputByAttr('path'), 'newpath');
      assert.strictEqual(this.model.path, 'newpath', 'Updates path on model');
      await click(GENERAL.backButton);
      assert.strictEqual(this.model.type, '', 'Clears type on back');
      assert.strictEqual(this.model.path, 'newpath', 'Path is still newPath');
      await click(MOUNT_BACKEND_FORM.mountType('aws'));
      assert.strictEqual(this.model.type, 'aws', 'Updates type on model');
      assert.dom(GENERAL.inputByAttr('path')).hasValue('newpath', 'keeps custom path value');
    });

    test('it does not show a selected token type when first mounting an auth method', async function (assert) {
      await render(
        hbs`<MountBackendForm @mountCategory="auth" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      await click(MOUNT_BACKEND_FORM.mountType('github'));
      await click(GENERAL.button('Method Options'));
      assert
        .dom('[data-test-input="config.token_type"]')
        .hasValue('', 'token type does not have a default value.');
      const selectOptions = document.querySelector('[data-test-input="config.token_type"]').options;
      assert.strictEqual(selectOptions[1].text, 'default-service', 'first option is default-service');
      assert.strictEqual(selectOptions[2].text, 'default-batch', 'second option is default-batch');
      assert.strictEqual(selectOptions[3].text, 'batch', 'third option is batch');
      assert.strictEqual(selectOptions[4].text, 'service', 'fourth option is service');
    });

    test('it calls mount success', async function (assert) {
      assert.expect(3);

      this.server.post('/sys/auth/foo', () => {
        assert.ok(true, 'it calls enable on an auth method');
        return [204, { 'Content-Type': 'application/json' }];
      });
      const spy = sinon.spy();
      this.set('onMountSuccess', spy);

      await render(
        hbs`<MountBackendForm @mountCategory="auth" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      await mountBackend('approle', 'foo');

      assert.true(spy.calledOnce, 'calls the passed success method');
      assert.true(
        this.flashSuccessSpy.calledWith('Successfully mounted the approle auth method at foo.'),
        'Renders correct flash message'
      );
    });
  });

  module('secrets engine', function (hooks) {
    hooks.beforeEach(function () {
      const defaults = {
        config: { listing_visibility: false },
        kv_config: {
          max_versions: 0,
          cas_required: false,
          delete_version_after: 0,
        },
        options: { version: 2 },
      };
      this.model = new SecretsEngineForm(defaults, { isNew: true });
    });

    test('it renders secret engine specific headers', async function (assert) {
      assert.expect(17);
      await render(
        hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      assert.dom(GENERAL.title).hasText('Enable a Secrets Engine', 'renders secrets header');
      for (const method of filterEnginesByMountCategory({
        mountCategory: 'secret',
        isEnterprise: false,
      }).filter((engine) => engine.type !== 'cubbyhole')) {
        assert
          .dom(MOUNT_BACKEND_FORM.mountType(method.type))
          .hasText(method.displayName, `renders type:${method.displayName} picker`);
      }
    });

    test('it changes path when type is changed', async function (assert) {
      await render(
        hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      await click(MOUNT_BACKEND_FORM.mountType('azure'));
      assert.dom(GENERAL.inputByAttr('path')).hasValue('azure', 'sets the value of the type');
      await click(GENERAL.backButton);
      await click(MOUNT_BACKEND_FORM.mountType('nomad'));
      assert.dom(GENERAL.inputByAttr('path')).hasValue('nomad', 'updates the value of the type');
    });

    test('it keeps path value if the user has changed it', async function (assert) {
      await render(
        hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );
      await click(MOUNT_BACKEND_FORM.mountType('kv'));
      assert.strictEqual(this.model.type, 'kv', 'Updates type on model');
      assert.dom(GENERAL.inputByAttr('path')).hasValue('kv', 'path matches mount type');
      await fillIn(GENERAL.inputByAttr('path'), 'newpath');
      assert.strictEqual(this.model.path, 'newpath', 'Updates path on model');
      await click(GENERAL.backButton);
      assert.strictEqual(this.model.type, '', 'Clears type on back');
      assert.strictEqual(this.model.path, 'newpath', 'path is still newpath');
      await click(MOUNT_BACKEND_FORM.mountType('ssh'));
      assert.strictEqual(this.model.type, 'ssh', 'Updates type on model');
      assert.dom(GENERAL.inputByAttr('path')).hasValue('newpath', 'path stays the same');
    });

    test('it calls mount success', async function (assert) {
      assert.expect(3);

      this.server.post('/sys/mounts/foo', () => {
        assert.ok(true, 'it calls enable on an secrets engine');
        return [204, { 'Content-Type': 'application/json' }];
      });
      const spy = sinon.spy();
      this.set('onMountSuccess', spy);

      await render(
        hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
      );

      await mountBackend('ssh', 'foo');

      assert.true(spy.calledOnce, 'calls the passed success method');
      assert.true(
        this.flashSuccessSpy.calledWith('Successfully mounted the ssh secrets engine at foo.'),
        'Renders correct flash message'
      );
    });

    module('WIF secret engines', function () {
      test('it shows identity_token_key when type is a WIF engine and hides when its not', async function (assert) {
        await render(
          hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
        );
        for (const engine of WIF_ENGINES) {
          await click(MOUNT_BACKEND_FORM.mountType(engine));
          await click(GENERAL.button('Method Options'));
          assert
            .dom(GENERAL.fieldByAttr('config.identity_token_key'))
            .exists(`Identity token key field shows when type=${this.model.type}`);
          await click(GENERAL.backButton);
        }
        for (const engine of filterEnginesByMountCategory({
          mountCategory: 'secret',
          isEnterprise: false,
        }).filter((e) => !WIF_ENGINES.includes(e.type) && e.type !== 'cubbyhole')) {
          // check non-wif engine
          await click(MOUNT_BACKEND_FORM.mountType(engine.type));
          await click(GENERAL.button('Method Options'));
          assert
            .dom(GENERAL.fieldByAttr('config.identity_token_key'))
            .doesNotExist(`Identity token key field hidden when type=${this.model.type}`);
          await click(GENERAL.backButton);
        }
      });

      test('it updates identity_token_key if user has changed it', async function (assert) {
        await render(
          hbs`<MountBackendForm @mountCategory="secret" @mountModel={{this.model}} @onMountSuccess={{this.onMountSuccess}} />`
        );
        assert.strictEqual(
          this.model.config.identity_token_key,
          undefined,
          `On init identity_token_key is not set on the model`
        );
        for (const engine of WIF_ENGINES) {
          await click(MOUNT_BACKEND_FORM.mountType(engine));
          await click(GENERAL.button('Method Options'));
          await typeIn(GENERAL.inputSearch('key'), `${engine}+specialKey`); // set to something else

          assert.strictEqual(
            this.model.config.identity_token_key,
            `${engine}+specialKey`,
            `updates ${engine} model with custom identity_token_key`
          );
          await click(GENERAL.backButton);
        }
      });
    });
  });
});
