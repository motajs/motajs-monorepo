import * as Blockly from 'blockly';

export interface UnknownBlockRegistrationRequest {
  blockId: string;
  raw: string;
}

let registrationHandler: ((request: UnknownBlockRegistrationRequest) => void) | null = null;

export function setUnknownBlockRegistrationHandler(
  handler: ((request: UnknownBlockRegistrationRequest) => void) | null,
): void {
  registrationHandler = handler;
}

interface FieldActionConfig extends Blockly.FieldLabelFromJsonConfig {
  action?: 'registerUnknownEvent';
}

export class FieldActionButton extends Blockly.FieldLabel {
  override EDITABLE = true;
  private readonly action: FieldActionConfig['action'];

  constructor(value = '注册自定义块', action: FieldActionConfig['action'] = 'registerUnknownEvent') {
    super(value, 'blocklyActionField');
    this.action = action;
  }

  static fromJson(options: FieldActionConfig): FieldActionButton {
    return new FieldActionButton(options.text ?? '注册自定义块', options.action);
  }

  protected override showEditor_(): void {
    if (this.action !== 'registerUnknownEvent') return;
    const block = this.getSourceBlock();
    if (!block) return;
    registrationHandler?.({
      blockId: block.id,
      raw: String(block.getFieldValue('JSON_DATA') ?? ''),
    });
  }
}

let registered = false;

export function registerFieldActionButton(): void {
  if (registered) return;
  Blockly.fieldRegistry.register('field_mota_action', FieldActionButton);
  registered = true;
}
