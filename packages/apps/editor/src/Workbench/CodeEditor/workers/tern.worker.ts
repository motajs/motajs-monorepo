import * as Tern from "tern";
import "tern/plugin/complete_strings";
import "tern/plugin/doc_comment";
import { registerSemanticTypesQuery } from "../utils/semanticTypesQuery";

interface InitMessage {
  type: "init";
  defs: Tern.Def[];
  plugins: Tern.ConstructorOptions["plugins"];
}

interface AddMessage {
  type: "add";
  name: string;
  text: string;
}

interface DeleteMessage {
  type: "del";
  name: string;
}

interface RequestMessage {
  type: "req";
  id?: number;
  body: Tern.Document;
}

interface FileResponseMessage {
  type: "getFile";
  id: number;
  err?: string;
  text?: string;
}

type IncomingMessage = InitMessage | AddMessage | DeleteMessage | RequestMessage | FileResponseMessage;

type FileCallback = (error?: Error, text?: string) => void;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage(message: unknown): void;
};

registerSemanticTypesQuery();

let server: Tern.Server | undefined;
let nextFileRequestId = 0;
const pendingFiles = new Map<number, FileCallback>();

function getFile(name: string, callback: FileCallback): void {
  const id = ++nextFileRequestId;
  pendingFiles.set(id, callback);
  workerScope.postMessage({ type: "getFile", name, id });
}

workerScope.onmessage = (event) => {
  const data = event.data;
  switch (data.type) {
    case "init":
      server = new Tern.Server({
        async: true,
        defs: data.defs,
        getFile,
        plugins: data.plugins,
      });
      break;
    case "add":
      server?.addFile(data.name, data.text);
      break;
    case "del":
      server?.delFile(data.name);
      break;
    case "req":
      if (!server) {
        workerScope.postMessage({ id: data.id, err: "Tern worker is not initialized" });
        break;
      }
      server.request(data.body, (error, response) => {
        workerScope.postMessage({
          id: data.id,
          body: response,
          err: error ? String(error) : undefined,
        });
      });
      break;
    case "getFile": {
      const callback = pendingFiles.get(data.id);
      pendingFiles.delete(data.id);
      callback?.(data.err ? new Error(data.err) : undefined, data.text);
      break;
    }
  }
};
