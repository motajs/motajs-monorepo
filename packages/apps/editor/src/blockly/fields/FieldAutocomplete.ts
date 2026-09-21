import * as Blockly from 'blockly';
import Awesomplete from 'awesomplete';
import 'awesomplete/awesomplete.css';
import { projectModel, type BlocklyCompletionCatalog, type BlocklyCompletionItem } from '@/project/model/projectModel';
import { editorConfigService } from '@/services/editorConfig';
import type { BlocklyCompletionSourceId } from '../registry';
import { FieldTextInput } from './FieldTextInput';

interface FieldAutocompleteConfig extends Blockly.FieldTextInputFromJsonConfig {
  completionSource?: BlocklyCompletionSourceId;
}

interface CompletionSuggestion {
  label: string;
  value: string;
}

interface CompletionResult {
  prefix: string;
  replaceStart: number;
  replaceEnd: number;
  suggestions: CompletionSuggestion[];
}

function rankCompletions(values: BlocklyCompletionItem[]): BlocklyCompletionItem[] {
  const recent = editorConfigService.get<string[]>('blocklyCompletionRecent', []);
  return [...values].sort((a, b) => {
    const ai = recent.indexOf(a.value);
    const bi = recent.indexOf(b.value);
    if (ai !== bi) return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    return a.value.length - b.value.length || a.value.localeCompare(b.value);
  });
}

function sourceForContext(valueBeforeCaret: string): { source: string; prefix: string } | null {
  const colon =
    /(?:^|[^\w])(status|item|flag|enemy):([A-Za-z0-9_\u4E00-\u9FCC\u3040-\u30FF\u2160-\u216B\u0391-\u03C9]*)$/.exec(
      valueBeforeCaret,
    );
  if (colon) return { source: colon[1] === 'status' ? 'status' : colon[1], prefix: colon[2] };
  const dot = /(?:^|[^\w])(hero|flags)\.([A-Za-z0-9_]*)$/.exec(valueBeforeCaret);
  if (dot) return { source: dot[1] === 'hero' ? 'status' : 'flag', prefix: dot[2] };
  const escape = /\\([ifrg])\[([^\]]*)$/.exec(valueBeforeCaret);
  if (escape) {
    const source = escape[1] === 'i' ? 'id' : escape[1] === 'f' ? 'image' : escape[1] === 'r' ? 'color' : 'font';
    return { source, prefix: escape[2] };
  }
  if (valueBeforeCaret.endsWith('\\')) return { source: 'textEscape', prefix: '\\' };
  const core = /(?:^|[^\w])core\.([A-Za-z0-9_]*)$/.exec(valueBeforeCaret);
  if (core) return { source: 'core', prefix: core[1] };
  return null;
}

function completionLabel(item: BlocklyCompletionItem): string {
  return item.label && item.label !== item.value ? `${item.value}（${item.label}）` : item.value;
}

export function resolveBlocklyCompletions(
  catalog: BlocklyCompletionCatalog,
  source: BlocklyCompletionSourceId,
  value: string,
  caret: number,
): CompletionResult {
  const before = value.slice(0, caret);
  const contextual = sourceForContext(before);
  const token = /[A-Za-z0-9_.\-\u4E00-\u9FCC\u3040-\u30FF\u2160-\u216B\u0391-\u03C9]*$/.exec(before)?.[0] ?? '';
  const selectedSource = contextual?.source ?? source;
  const prefix = contextual?.prefix ?? token;
  const suffix =
    /^[A-Za-z0-9_.\-\u4E00-\u9FCC\u3040-\u30FF\u2160-\u216B\u0391-\u03C9]*/.exec(value.slice(caret))?.[0] ?? '';
  const replaceStart = Math.max(0, caret - prefix.length);
  const replaceEnd = caret + suffix.length;
  const values =
    selectedSource === 'contextual'
      ? []
      : selectedSource === 'auto'
        ? catalog.all
        : (catalog.bySource[selectedSource] ?? catalog.bySource.expression ?? catalog.all);
  const normalizedPrefix = prefix.toLocaleLowerCase();
  const suggestions = rankCompletions(values)
    .filter((item) => item.value !== prefix && item.value.toLocaleLowerCase().startsWith(normalizedPrefix))
    .slice(0, 100)
    .map((item) => ({ label: completionLabel(item), value: item.value }));
  return { prefix, replaceStart, replaceEnd, suggestions };
}

export class FieldAutocomplete extends FieldTextInput {
  private readonly completionSource: BlocklyCompletionSourceId;
  private awesomplete: Awesomplete | null = null;
  private inputListener: (() => void) | null = null;
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private editorGeneration = 0;

  constructor(value = '', completionSource: BlocklyCompletionSourceId = 'contextual') {
    super(value);
    this.completionSource = completionSource;
  }

  static fromJson(options: Blockly.FieldTextInputFromJsonConfig): FieldAutocomplete {
    const config = options as FieldAutocompleteConfig;
    return new FieldAutocomplete(config.text ?? '', config.completionSource ?? 'contextual');
  }

  getCompletionSource(): BlocklyCompletionSourceId {
    return this.completionSource;
  }

  protected override showEditor_(event?: Event, quietInput?: boolean, manageEphemeralFocus?: boolean): void {
    this.disposeAutocomplete();
    const generation = ++this.editorGeneration;
    super.showEditor_(event, quietInput, manageEphemeralFocus);
    const input = this.htmlInput_;
    if (!input) return;
    void this.installAutocomplete(input, generation);
  }

  protected override widgetDispose_(): void {
    this.editorGeneration += 1;
    this.disposeAutocomplete();
    super.widgetDispose_();
  }

  private async installAutocomplete(input: HTMLInputElement, generation: number): Promise<void> {
    const resource = projectModel.blocklyCompletions();
    let snapshot = resource.snapshot();
    if (snapshot.status !== 'loaded') {
      try {
        await resource.ensureLoaded();
      } catch {
        return;
      }
      snapshot = resource.snapshot();
    }
    if (
      snapshot.status !== 'loaded' ||
      generation !== this.editorGeneration ||
      this.htmlInput_ !== input ||
      !input.isConnected
    )
      return;

    let replaceStart = 0;
    let replaceEnd = 0;
    const awesomplete = new Awesomplete(input, {
      minChars: 0,
      maxItems: 12,
      autoFirst: true,
      filter: () => true,
      sort: false,
      replace: (raw) => {
        const suggestion = raw as { value?: string } | string;
        const replacement = typeof suggestion === 'string' ? suggestion : (suggestion.value ?? String(suggestion));
        const recent = editorConfigService.get<string[]>('blocklyCompletionRecent', []);
        editorConfigService.set(
          'blocklyCompletionRecent',
          [replacement, ...recent.filter((item) => item !== replacement)].slice(0, 50),
        );
        const next = `${input.value.slice(0, replaceStart)}${replacement}${input.value.slice(replaceEnd)}`;
        input.value = next;
        this.setValue(next);
        this.forceRerender();
        this.resizeEditor_();
        const nextCaret = replaceStart + replacement.length;
        input.setSelectionRange(nextCaret, nextCaret);
      },
    });
    awesomplete.container.classList.add('blocklyAutocomplete');

    const refresh = () => {
      const caret = input.selectionEnd ?? input.value.length;
      const result = resolveBlocklyCompletions(snapshot.value, this.completionSource, input.value, caret);
      replaceStart = result.replaceStart;
      replaceEnd = result.replaceEnd;
      awesomplete.list = result.suggestions.map((item) => ({ label: item.label, value: item.value }));
      if (result.suggestions.length > 0) awesomplete.evaluate();
      else awesomplete.close();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !awesomplete.opened || !awesomplete.selected) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      awesomplete.select();
    };
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', handleKeydown, true);
    this.awesomplete = awesomplete;
    this.inputListener = refresh;
    this.keydownListener = handleKeydown;
    refresh();
  }

  private disposeAutocomplete(): void {
    const input = this.htmlInput_;
    if (input && this.inputListener) input.removeEventListener('input', this.inputListener);
    if (input && this.keydownListener) input.removeEventListener('keydown', this.keydownListener, true);
    this.awesomplete?.destroy();
    this.awesomplete = null;
    this.inputListener = null;
    this.keydownListener = null;
  }
}

let registered = false;

export function registerFieldAutocomplete(): void {
  if (registered) return;
  Blockly.fieldRegistry.register('field_mota_autocomplete', FieldAutocomplete);
  registered = true;
}
