/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: BUSL-1.1
 */

import { Base } from '../show';
import { create, clickable, collection, isPresent } from 'ember-cli-page-object';

export default create({
  ...Base,
  deleteBtnV1: clickable('[data-test-secret-v1-delete]'),
  rows: collection('data-test-row-label'),
  edit: clickable('[data-test-secret-edit]'),
  editIsPresent: isPresent('[data-test-secret-edit]'),
});
