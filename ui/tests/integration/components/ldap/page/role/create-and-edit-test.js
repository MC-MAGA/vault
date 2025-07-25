/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: BUSL-1.1
 */

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { setupEngine } from 'ember-engines/test-support';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { render, click, fillIn } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';
import { ldapRoleID } from 'vault/adapters/ldap/role';
import { GENERAL } from 'vault/tests/helpers/general-selectors';

module('Integration | Component | ldap | Page::Role::CreateAndEdit', function (hooks) {
  setupRenderingTest(hooks);
  setupEngine(hooks, 'ldap');
  setupMirage(hooks);

  hooks.beforeEach(function () {
    const router = this.owner.lookup('service:router');
    const routerStub = sinon.stub(router, 'transitionTo');
    this.transitionCalledWith = (routeName, name) => {
      const route = `vault.cluster.secrets.backend.ldap.${routeName}`;
      const args = name ? [route, name] : [route];
      return routerStub.calledWith(...args);
    };

    this.store = this.owner.lookup('service:store');
    this.newModel = this.store.createRecord('ldap/role', { backend: 'ldap-test' });

    ['static', 'dynamic'].forEach((type) => {
      const name = `${type}-role`;
      this[`${type}RoleData`] = this.server.create('ldap-role', type, { name, id: ldapRoleID(type, name) });
      this.store.pushPayload('ldap/role', {
        modelName: 'ldap/role',
        backend: 'ldap-test',
        type,
        ...this[`${type}RoleData`],
      });
    });

    this.breadcrumbs = [
      { label: 'ldap', route: 'overview' },
      { label: 'Roles', route: 'roles' },
      { label: 'Create' },
    ];

    this.fetchModel = (type, name) => this.store.peekRecord('ldap/role', ldapRoleID(type, name));

    this.renderComponent = () => {
      return render(
        hbs`<Page::Role::CreateAndEdit @model={{this.model}} @breadcrumbs={{this.breadcrumbs}} />`,
        { owner: this.engine }
      );
    };
  });

  test('it should display different form fields based on type', async function (assert) {
    assert.expect(12);

    this.model = this.newModel;
    await this.renderComponent();

    assert.dom('[data-test-radio-card="static"]').isChecked('Static role type selected by default');

    const checkFields = (fields) => {
      fields.forEach((field) => {
        assert.dom(GENERAL.fieldByAttr(field)).exists(`${field} field renders when static type is selected`);
      });
    };

    checkFields(['name', 'dn', 'username', 'rotation_period']);
    await click('[data-test-radio-card="dynamic"]');
    checkFields([
      'name',
      'default_ttl',
      'max_ttl',
      'username_template',
      'creation_ldif',
      'deletion_ldif',
      'rollback_ldif',
    ]);
  });

  test('it should populate form and disable type cards when editing', async function (assert) {
    assert.expect(13);

    const checkFields = (fields, element = 'input:last-child') => {
      fields.forEach((field) => {
        const isLdif = field.includes('ldif');
        const method = isLdif ? 'includesText' : 'hasValue';
        const value = isLdif ? 'dn: cn={{.Username}},ou=users,dc=learn,dc=example' : this.model[field];
        assert.dom(`${GENERAL.fieldByAttr(field)} ${element}`)[method](value, `${field} field value renders`);
      });
    };
    const checkTtl = (fields) => {
      fields.forEach((field) => {
        assert
          .dom(`${GENERAL.fieldByAttr(field)} [data-test-ttl-inputs] input`)
          .hasAnyValue(`${field} field ttl value renders`);
      });
    };

    this.model = this.fetchModel('static', 'static-role');
    await this.renderComponent();
    assert.dom('[data-test-radio-card="static"]').isDisabled('Type selection is disabled when editing');
    assert.dom(GENERAL.inputByAttr('name')).isDisabled('Name field is disabled when editing');
    checkFields(['name', 'dn', 'username']);
    checkTtl(['rotation_period']);

    this.model = this.fetchModel('dynamic', 'dynamic-role');
    await this.renderComponent();
    checkFields(['name', 'username_template']);
    checkTtl(['default_ttl', 'max_ttl']);
    checkFields(['creation_ldif', 'deletion_ldif', 'rollback_ldif'], '.cm-content');
  });

  test('it should go back to list route and clean up model on cancel', async function (assert) {
    this.model = this.fetchModel('static', 'static-role');
    const spy = sinon.spy(this.model, 'rollbackAttributes');

    await this.renderComponent();
    await click(GENERAL.cancelButton);

    assert.ok(spy.calledOnce, 'Model is rolled back on cancel');
    assert.ok(this.transitionCalledWith('roles'), 'Transitions to roles list route on cancel');
  });

  test('it should validate form fields', async function (assert) {
    const renderAndAssert = async (fields) => {
      await this.renderComponent();
      await click(GENERAL.submitButton);

      fields.forEach((field) => {
        assert.dom(GENERAL.validationErrorByAttr(field)).exists('Validation message renders');
      });

      assert
        .dom('[data-test-invalid-form-message]')
        .hasText(`There are ${fields.length} errors with this form.`);
    };

    this.model = this.newModel;
    await renderAndAssert(['name', 'username', 'rotation_period']);

    await click('[data-test-radio-card="dynamic"]');
    await renderAndAssert(['name', 'creation_ldif', 'deletion_ldif']);
  });

  test('it should create new role', async function (assert) {
    assert.expect(2);

    this.server.post('/ldap-test/static-role/test-role', (schema, req) => {
      const data = JSON.parse(req.requestBody);
      const expected = { dn: 'foo', username: 'bar', rotation_period: '5s' };
      assert.deepEqual(data, expected, 'POST request made with correct properties when creating role');
    });

    this.model = this.newModel;
    await this.renderComponent();

    await fillIn(GENERAL.inputByAttr('name'), 'test-role');
    await fillIn(GENERAL.inputByAttr('dn'), 'foo');
    await fillIn(GENERAL.inputByAttr('username'), 'bar');
    await fillIn(GENERAL.ttl.input('Rotation period'), 5);
    await click(GENERAL.submitButton);

    assert.ok(
      this.transitionCalledWith('roles.role.details', 'static', 'test-role'),
      'Transitions to role details route on save success'
    );
  });

  test('it should save edited role with correct properties', async function (assert) {
    assert.expect(2);

    this.server.post('/ldap-test/static-role/:name', (schema, req) => {
      const data = JSON.parse(req.requestBody);
      const expected = { dn: 'foo', username: 'bar', rotation_period: '30s' };
      assert.deepEqual(expected, data, 'POST request made to save role with correct properties');
    });

    this.model = this.fetchModel('static', 'static-role');
    await this.renderComponent();

    await fillIn(GENERAL.inputByAttr('dn'), 'foo');
    await fillIn(GENERAL.inputByAttr('username'), 'bar');
    await fillIn(GENERAL.ttl.input('Rotation period'), 30);
    await click(GENERAL.submitButton);

    assert.ok(
      this.transitionCalledWith('roles.role.details', 'static', 'test-role'),
      'Transitions to role details route on save success'
    );
  });
});
