import * as Blockly from 'blockly';
import { projectModel } from '@/project/model/projectModel';
import { editorConfigService } from '@/services/editorConfig';
import type { BlocklyCompletionSourceId } from '../registry';

interface FieldAutocompleteConfig extends Blockly.FieldTextInputFromJsonConfig {
  completionSource?: BlocklyCompletionSourceId;
}

function rankCompletions(values: string[]): string[] {
  const recent = editorConfigService.get<string[]>('blocklyCompletionRecent', []);
  return [...values].sort((a, b) => {
    const ai = recent.indexOf(a);
    const bi = recent.indexOf(b);
    if (ai !== bi) return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    return a.length - b.length || a.localeCompare(b);
  });
}

export class FieldAutocomplete extends Blockly.FieldTextInput {
  private readonly completionSource: BlocklyCompletionSourceId;

  constructor(value = '', completionSource: BlocklyCompletionSourceId = 'expression') {
    super(value, (next) => {
      if (typeof next === 'string' && next) {
        const recent = editorConfigService.get<string[]>('blocklyCompletionRecent', []);
        editorConfigService.set('blocklyCompletionRecent', [next, ...recent.filter((item) => item !== next)].slice(0, 50));
      }
      return next;
    });
    this.completionSource = completionSource;
  }

  static fromJson(options: Blockly.FieldTextInputFromJsonConfig): FieldAutocomplete {
    const config = options as FieldAutocompleteConfig;
    return new FieldAutocomplete(config.text ?? '', config.completionSource ?? 'expression');
  }

  protected override showEditor_(event?: Event, quietInput?: boolean, manageEphemeralFocus?: boolean): void {
    super.showEditor_(event, quietInput, manageEphemeralFocus);
    const input = this.htmlInput_;
    if (!input) return;
    const resource = projectModel.blocklyCompletions();
    const snapshot = resource.snapshot();
    if (snapshot.status !== 'loaded') {
      void resource.reload();
      return;
    }
    const values = rankCompletions(
      (snapshot.value.bySource[this.completionSource] ?? snapshot.value.all).map((item) => item.value),
    );
    const id = `blockly-completions-${this.getSourceBlock()?.id ?? 'field'}-${this.name ?? 'input'}`;
    const dataList = document.createElement('datalist');
    dataList.id = id;
    values.slice(0, 100).forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      dataList.append(option);
    });
    input.setAttribute('list', id);
    input.parentElement?.append(dataList);
  }
}

let registered = false;

export function registerFieldAutocomplete(): void {
  if (registered) return;
  Blockly.fieldRegistry.register('field_mota_autocomplete', FieldAutocomplete);
  registered = true;
}
