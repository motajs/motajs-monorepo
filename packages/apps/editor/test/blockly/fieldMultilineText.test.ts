import { beforeAll, describe, expect, it } from "vitest";
import {
  FieldMultilineText,
  readTextControlCharacters,
  showTextControlCharacters,
  softWrapMultilineText,
} from "@/blockly/fields/FieldMultilineText";
import { parseEvent } from "@/blockly/parser/eventToState";
import { registerAllSchemas } from "@/blockly/schemas";

beforeAll(() => {
  registerAllSchemas();
});

describe("FieldMultilineText", () => {
  it("soft-wraps long lines without changing their value", () => {
    const value = "这是一段需要自动换行的中文文本和ASCII-text";
    const lines = softWrapMultilineText(value, 12);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(value);
  });

  it("uses the legacy fifty-character display width", () => {
    const value = "字".repeat(101);
    expect(softWrapMultilineText(value)).toEqual([
      "字".repeat(50),
      "字".repeat(50),
      "字",
    ]);
  });

  it("preserves explicit newlines and empty lines", () => {
    expect(softWrapMultilineText("first\n\nsecond", 40)).toEqual([
      "first",
      "",
      "second",
    ]);
  });

  it("constructs the modern field from JSON", () => {
    const field = FieldMultilineText.fromJson({ text: "line one\nline two" });
    expect(field).toBeInstanceOf(FieldMultilineText);
    expect(field.getValue()).toBe("line one\nline two");
  });

  it("shows runtime directives without flattening real newlines", () => {
    const runtime = "第一行\r[red]\n第二行\f[face.png,0,0]";
    expect(showTextControlCharacters(runtime)).toBe(
      "第一行\\r[red]\n第二行\\f[face.png,0,0]",
    );
  });

  it("restores visible directives before storing the field value", () => {
    const visible = "正文\\r[red]\n下一行\\r[]";
    expect(readTextControlCharacters(visible)).toBe("正文\r[red]\n下一行\r[]");
  });
});

describe("text control prefixes", () => {
  it("keeps plain text objects on the compact block", () => {
    const state = parseEvent({ type: "text", text: "普通正文" }, { entryType: "event" });
    expect(state.type).toBe("mota_text_0_s");
    expect(state.fields?.TEXT).toBe("普通正文");
  });

  it("uses the detailed block only when advanced text options exist", () => {
    const state = parseEvent({
      type: "text",
      text: "带定位的正文",
      pos: [16, 32, 240],
      code: 1,
    }, { entryType: "event" });
    expect(state.type).toBe("mota_text_1_s");
    expect(state.fields).toMatchObject({ POS_X: "16", POS_Y: "32", POS_W: "240", CODE: "1" });
  });

  it("parses evaluated project strings with tab and backspace prefixes", () => {
    const state = parseEvent("\t[老人,man]\b[this]你好！", { entryType: "event" });

    expect(state.type).toBe("mota_text_1_s");
    expect(state.fields).toMatchObject({
      TITLE: "老人",
      ICON: "man",
      POSITION: "this",
      TEXT: "你好！",
    });
  });

  it("still accepts literal escape sequences from external callers", () => {
    const state = parseEvent("\\t[老人,man]你好！", { entryType: "event" });
    expect(state.type).toBe("mota_text_1_s");
    expect(state.fields?.TEXT).toBe("你好！");
  });
});
