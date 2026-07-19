import CodeMirror from "codemirror";
import type { TernServerInstance } from "../CodeEditor/utils";

const SCRIPT_MODE = {
  name: "javascript",
  globalVars: true,
  localVars: true,
} as CodeMirror.ModeSpec<{ globalVars: boolean; localVars: boolean }>;

type TernDocumentServer = Pick<TernServerInstance, "addDoc" | "delDoc">;

/** Owns the editing buffer and history for every open script tab. */
export class ScriptDocumentRegistry {
  private readonly documents = new Map<string, CodeMirror.Doc>();
  private ternServer?: TernDocumentServer;

  open(id: string, value: string): CodeMirror.Doc {
    const existing = this.documents.get(id);
    if (existing) return existing;
    const document = new CodeMirror.Doc(value, SCRIPT_MODE);
    this.documents.set(id, document);
    this.ternServer?.addDoc(id, document);
    return document;
  }

  get(id: string): CodeMirror.Doc | undefined {
    return this.documents.get(id);
  }

  setValue(id: string, value: string): void {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Script document is not open: ${id}`);
    if (document.getValue() !== value) document.setValue(value);
  }

  rename(previousId: string, nextId: string): void {
    if (previousId === nextId) return;
    const document = this.documents.get(previousId);
    if (!document) return;
    if (this.documents.has(nextId)) throw new Error(`Script document is already open: ${nextId}`);
    this.ternServer?.delDoc(previousId);
    this.documents.delete(previousId);
    this.documents.set(nextId, document);
    this.ternServer?.addDoc(nextId, document);
  }

  close(id: string): void {
    if (!this.documents.delete(id)) return;
    this.ternServer?.delDoc(id);
  }

  retain(ids: ReadonlySet<string>): void {
    for (const id of this.documents.keys()) {
      if (!ids.has(id)) this.close(id);
    }
  }

  attachTern(server: TernDocumentServer): void {
    if (this.ternServer === server) return;
    if (this.ternServer) {
      for (const id of this.documents.keys()) this.ternServer.delDoc(id);
    }
    this.ternServer = server;
    for (const [id, document] of this.documents) server.addDoc(id, document);
  }

  detachTern(server: TernDocumentServer): void {
    if (this.ternServer !== server) return;
    for (const id of this.documents.keys()) server.delDoc(id);
    this.ternServer = undefined;
  }
}
