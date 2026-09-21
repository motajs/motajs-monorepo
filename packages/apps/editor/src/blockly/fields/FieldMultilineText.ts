import * as Blockly from 'blockly';
import { FieldMultilineInput, type FieldMultilineInputFromJsonConfig } from '@blockly/field-multilineinput';

// Match Blockly's legacy maxDisplayLength, but wrap instead of truncating.
const DEFAULT_WRAP_COLUMNS = 50;

const VISIBLE_CONTROL_CHARACTERS: Readonly<Record<string, string>> = {
  '\b': '\\b',
  '\t': '\\t',
  '\f': '\\f',
  '\r': '\\r',
};

/** Keep runtime text directives visible without changing real line breaks. */
export function showTextControlCharacters(value: string): string {
  return value.replace(/[\b\t\f\r]/g, (character) => VISIBLE_CONTROL_CHARACTERS[character]);
}

/** Restore visible directives before writing the Blockly field value. */
export function readTextControlCharacters(value: string): string {
  return value.replace(/\\([btfr])/g, (_match, directive: string) => {
    if (directive === 'b') return '\b';
    if (directive === 't') return '\t';
    if (directive === 'f') return '\f';
    return '\r';
  });
}

/** Soft-wrap text for SVG display without adding newlines to the field value. */
export function softWrapMultilineText(value: string, maxColumns = DEFAULT_WRAP_COLUMNS): string[] {
  const wrapped: string[] = [];
  for (const sourceLine of value.split('\n')) {
    if (!sourceLine) {
      wrapped.push('');
      continue;
    }

    let line = '';
    let columns = 0;
    for (const character of sourceLine) {
      if (line && columns + 1 > maxColumns) {
        wrapped.push(line);
        line = '';
        columns = 0;
      }
      line += character;
      columns += 1;
    }
    wrapped.push(line);
  }
  return wrapped;
}

export class FieldMultilineText extends FieldMultilineInput {
  override initView(): void {
    super.initView();
    this.getSvgRoot()?.setAttribute('data-test-id', 'blockly-multiline-field');
  }

  protected override getDisplayText_(): string {
    const block = this.getSourceBlock();
    if (!block) {
      throw new Error('The multiline field must be attached before rendering.');
    }

    const value = showTextControlCharacters(this.getText());
    if (!value) return Blockly.Field.NBSP;

    let lines = softWrapMultilineText(value);
    if (Number.isFinite(this.maxLines_) && lines.length > this.maxLines_) {
      lines = lines.slice(0, this.maxLines_);
      const last = lines.length - 1;
      lines[last] = `${lines[last].replace(/\s+$/u, '')}...`;
    }

    let display = lines.map((line) => line.replace(/\s/gu, Blockly.Field.NBSP)).join('\n');
    if (block.RTL) display += '\u200f';
    return display;
  }

  protected override updateSize_(): void {
    // The upstream field expands to the unwrapped source width while editing.
    // Size from the wrapped SVG rows instead so the textarea stays in place.
    const wasEditing = this.isBeingEdited_;
    this.isBeingEdited_ = false;
    super.updateSize_();
    this.isBeingEdited_ = wasEditing;
  }

  protected override render_(): void {
    super.render_();
    for (const line of this.textGroup?.children ?? []) {
      line.setAttribute('data-test-id', 'blockly-multiline-line');
    }
  }

  protected override widgetCreate_(): HTMLTextAreaElement {
    const input = super.widgetCreate_();
    input.setAttribute('data-test-id', 'blockly-multiline-editor');
    input.wrap = 'soft';
    input.style.boxSizing = 'border-box';
    input.style.margin = '0';
    input.style.textIndent = '0';
    input.style.whiteSpace = 'pre-wrap';
    input.style.overflowWrap = 'anywhere';
    input.style.tabSize = '2';
    return input;
  }

  protected override getEditorText_(value: string): string {
    return showTextControlCharacters(value);
  }

  protected override getValueFromEditorText_(value: string): string {
    return readTextControlCharacters(value);
  }

  static override fromJson(options: FieldMultilineInputFromJsonConfig): FieldMultilineText {
    return new FieldMultilineText(
      Blockly.utils.parsing.replaceMessageReferences(options.text ?? ''),
      undefined,
      options,
    );
  }
}

export function registerFieldMultilineText(): void {
  Blockly.fieldRegistry.register('field_multilinetext', FieldMultilineText);
}
