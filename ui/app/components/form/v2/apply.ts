/**
 * Copyright IBM Corp. 2016, 2025
 * SPDX-License-Identifier: BUSL-1.1
 */

import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { generateCurlCommand } from 'core/utils/code-generators/api';
import { generateCliWriteCommand } from 'core/utils/code-generators/cli';
import { terraformGenericResourceTemplate } from 'core/utils/code-generators/terraform';

import type V2Form from 'vault/forms/v2/v2-form';
import type NamespaceService from 'vault/services/namespace';

interface Args {
  form: V2Form;
  onBack: () => void;
  onDone: () => void;
  onApply: () => void;
}

export enum CreationMethod {
  TERRAFORM = 'Terraform automation',
  APICLI = 'API/CLI',
  UI = 'Vault UI workflow',
}

interface CreationMethodChoice {
  icon: string;
  label: CreationMethod;
  description: string;
  isRecommended?: boolean;
}

export default class FormV2Apply extends Component<Args> {
  @service declare readonly namespace: NamespaceService;

  @tracked creationMethodChoice = CreationMethod.TERRAFORM;
  @tracked selectedTabIdx = 0;

  methods = CreationMethod;

  creationMethodOptions: CreationMethodChoice[] = [
    {
      icon: 'terraform-color',
      label: CreationMethod.TERRAFORM,
      description:
        'Manage configurations by Infrastructure as Code. This creation method improves resilience and ensures common compliance requirements.',
      isRecommended: true,
    },
    {
      icon: 'terminal-screen',
      label: CreationMethod.APICLI,
      description:
        'Manage namespaces directly via the Vault CLI or REST API. Best for quick updates, custom scripting, or terminal-based workflows.',
    },
    {
      icon: 'sidebar',
      label: CreationMethod.UI,
      description:
        'Apply changes immediately. Note: Changes made in the UI will be overwritten by any future updates made via Infrastructure as Code (Terraform).',
    },
  ];

  get requestData() {
    const { payload } = this.args.form;
    // payload has a top level key -- we need the actual data object for creating the snippets
    return Object.values(payload)[0] as Record<string, unknown>;
  }

  get tfSnippet() {
    const { config } = this.args.form;
    return terraformGenericResourceTemplate(config.path, this.requestData, config.name, this.namespace.path);
  }

  get customTabs() {
    const { config } = this.args.form;
    return [
      {
        key: 'api',
        label: 'API',
        snippet: generateCurlCommand(config.path, this.requestData, this.namespace.path),
      },
      {
        key: 'cli',
        label: 'CLI',
        snippet: generateCliWriteCommand(config.path, this.requestData),
      },
    ];
  }

  @action
  onChange(choice: CreationMethodChoice) {
    this.creationMethodChoice = choice.label;
  }
}
