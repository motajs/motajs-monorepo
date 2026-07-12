import { describe, expect, it } from "vitest";
import { parseEditorEnvironment } from "./environment";

function environmentDocument(value: unknown): Document {
  const source = document.implementation.createHTMLDocument();
  const base = source.createElement("base");
  base.href = "https://example.test/editor/";
  source.head.appendChild(base);
  const script = source.createElement("script");
  script.id = "mota-editor-environment";
  script.textContent = JSON.stringify(value);
  source.head.appendChild(script);
  return source;
}

describe("editor environment", () => {
  it("resolves all host endpoints against the injected document base", () => {
    const result = parseEditorEnvironment(environmentDocument({
      protocolVersion: 1,
      endpoints: {
        fs: "../api/fs/",
        runtime: "./runtime.html",
        preview: "../preview/",
        docs: "../preview/_docs/",
        project: "../project/",
      },
    }));
    expect(result.endpoints).toEqual({
      fs: "https://example.test/api/fs/",
      runtime: "https://example.test/editor/runtime.html",
      preview: "https://example.test/preview/",
      docs: "https://example.test/preview/_docs/",
      project: "https://example.test/project/",
    });
  });

  it("rejects missing, duplicate, and incompatible configuration", () => {
    expect(() => parseEditorEnvironment(document.implementation.createHTMLDocument())).toThrow("exactly one");
    const duplicate = environmentDocument({ protocolVersion: 1, endpoints: {} });
    duplicate.head.appendChild(duplicate.querySelector("script")!.cloneNode(true));
    expect(() => parseEditorEnvironment(duplicate)).toThrow("exactly one");
    expect(() => parseEditorEnvironment(environmentDocument({ protocolVersion: 2, endpoints: {} }))).toThrow("Unsupported");
  });

  it("rejects missing endpoints", () => {
    expect(() => parseEditorEnvironment(environmentDocument({
      protocolVersion: 1,
      endpoints: { fs: "/", runtime: "/runtime.html" },
    }))).toThrow("endpoint 'preview'");
  });
});
