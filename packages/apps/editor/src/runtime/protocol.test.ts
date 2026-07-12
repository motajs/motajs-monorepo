import { describe, expect, it } from "vitest";
import { RUNTIME_PROTOCOL_VERSION, type RuntimeConnectMessage } from "./protocol";

describe("runtime host protocol", () => {
  it("requires protocol v2 and carries the host preview URL", () => {
    expect(RUNTIME_PROTOCOL_VERSION).toBe(2);
    const message: RuntimeConnectMessage = {
      type: "mota-runtime-connect",
      version: RUNTIME_PROTOCOL_VERSION,
      previewUrl: "https://example.test/service/1055/preview/",
    };
    expect(new URL("libs/loader.js", message.previewUrl).href)
      .toBe("https://example.test/service/1055/preview/libs/loader.js");
  });
});
