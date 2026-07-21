import "./localization/zh-cn";
import * as monaco from "monaco-editor/editor/editor.api";
import { clearMonacoViewState } from "./MonacoEditor";

export interface MonacoModelDescriptor {
  id: string;
  value: string;
  language?: string;
  uri?: string;
}

export class MonacoModelScope {
  private readonly models = new Map<string, monaco.editor.ITextModel>();
  private readonly pendingDeletes = new Map<string, number>();

  get(descriptor: MonacoModelDescriptor): monaco.editor.ITextModel {
    const current = this.models.get(descriptor.id);
    if (current && !current.isDisposed()) {
      if (descriptor.language && current.getLanguageId() !== descriptor.language) {
        monaco.editor.setModelLanguage(current, descriptor.language);
      }
      if (current.getValue() !== descriptor.value) current.setValue(descriptor.value);
      return current;
    }
    const uri = monaco.Uri.parse(descriptor.uri ?? `inmemory://motajs/${encodeURIComponent(descriptor.id)}.js`);
    const existing = monaco.editor.getModel(uri);
    const model = existing ?? monaco.editor.createModel(descriptor.value, descriptor.language ?? "javascript", uri);
    if (existing && descriptor.language && existing.getLanguageId() !== descriptor.language) {
      monaco.editor.setModelLanguage(existing, descriptor.language);
    }
    if (existing && existing.getValue() !== descriptor.value) existing.setValue(descriptor.value);
    this.models.set(descriptor.id, model);
    return model;
  }

  rename(previousId: string, next: MonacoModelDescriptor): monaco.editor.ITextModel | undefined {
    const previous = this.models.get(previousId);
    if (!previous) return undefined;
    const value = previous.getValue();
    this.delete(previousId);
    return this.get({ ...next, value });
  }

  retain(ids: ReadonlySet<string>): void {
    for (const id of ids) {
      const pending = this.pendingDeletes.get(id);
      if (pending !== undefined) window.clearTimeout(pending);
      this.pendingDeletes.delete(id);
    }
    for (const [id, model] of this.models) {
      if (ids.has(id) || this.pendingDeletes.has(id)) continue;
      const timer = window.setTimeout(() => {
        this.pendingDeletes.delete(id);
        if (this.models.get(id) === model) this.delete(id);
      });
      this.pendingDeletes.set(id, timer);
    }
  }

  delete(id: string): void {
    const pending = this.pendingDeletes.get(id);
    if (pending !== undefined) window.clearTimeout(pending);
    this.pendingDeletes.delete(id);
    const model = this.models.get(id);
    if (!model) return;
    this.models.delete(id);
    clearMonacoViewState(model);
    model.dispose();
  }

  dispose(): void {
    for (const id of [...this.models.keys()]) this.delete(id);
  }
}
