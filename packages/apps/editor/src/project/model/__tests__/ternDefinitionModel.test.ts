import { describe, expect, it } from "vitest";
import { Server } from "tern";
import type * as Tern from "tern";
import {
  buildTernDefinitionBundle,
  type TernDefinitionInputs,
} from "../ternDefinitionModel";

function baseDefs(): Tern.Def[] {
  return [
    { "!name": "browser" },
    { "!name": "ecmascript" },
    {
      "!name": "core",
      core: {
        material: {
          enemys: {},
          bgms: {},
          sounds: {},
          animates: {},
          images: {},
          items: {},
        },
        enemys: { hasSpecial: { "!doc": "特殊属性" } },
        canvas: {},
        status: {
          maps: {},
          bgmaps: {},
          fgmaps: {},
          shops: {},
          textAttribute: {},
        },
        values: {},
        flags: {},
        events: {},
        plugin: {},
      },
    },
  ] as Tern.Def[];
}

function inputs(): TernDefinitionInputs {
  return {
    baseDefs: baseDefs(),
    tower: {
      main: {
        floorIds: ["sample0"],
        bgms: ["bgm.mp3"],
        sounds: ["attack.mp3"],
        animates: ["explode.animate"],
        images: ["custom.png"],
        tilesets: ["tiles.png"],
      },
      firstData: {
        floorId: "sample0",
        shops: [{ id: "shop1", textInList: "测试商店" }],
      },
      values: { redGem: 3 },
      flags: { enableFloor: true },
    },
    items: { yellowKey: { name: "黄钥匙" } },
    enemys: { greenSlime: { name: "绿头怪" } },
    functions: {
      events: {
        customEvent: "function customEvent (value) { return value; }",
      },
      enemys: {
        getSpecials: "function getSpecials () { return [[1, '先攻'], [6, function () { return '连击'; }]]; }",
      },
    },
    plugins: {
      custom: "function custom () { this.customPlugin = function (count) { return count; }; }",
    },
    dataComment: {
      _type: "object",
      _data: {
        values: { _type: "object", _data: { redGem: { _type: "textarea", _data: "红宝石数值" } } },
        flags: { _type: "object", _data: { enableFloor: { _type: "textarea", _data: "显示楼层" } } },
      },
    },
    floors: [{ id: "sample0", floor: { floorId: "sample0", title: "样板层" } }],
    autotiles: ["autotile1"],
    diagnostics: [],
  } as unknown as TernDefinitionInputs;
}

function requestCompletions(server: Server, source: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    server.request({
      files: [{ type: "full", name: "test.js", text: source }],
      query: {
        type: "completions",
        file: "test.js",
        end: source.length,
        types: true,
      },
    }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      const completions = (response as { completions?: Array<string | { name: string }> }).completions ?? [];
      resolve(completions.map((item) => typeof item === "string" ? item : item.name));
    });
  });
}

describe("TernDefinitionModel", () => {
  it("clones base defs and enriches them from project data", () => {
    const source = inputs();
    const original = structuredClone(source.baseDefs);
    const bundle = buildTernDefinitionBundle(source);
    const core = (bundle.defs[2] as any).core;

    expect(source.baseDefs).toEqual(original);
    expect(core.material.enemys.greenSlime["!doc"]).toBe("绿头怪");
    expect(core.material.items.yellowKey["!doc"]).toBe("黄钥匙");
    expect(core.material.images.autotile.autotile1["!type"]).toBe("image");
    expect(core.status.maps.sample0["!doc"]).toBe("样板层");
    expect(core.status.shops.shop1["!doc"]).toBe("测试商店");
    expect(core.values.redGem["!doc"]).toBe("红宝石数值");
    expect(core.flags.enableFloor["!doc"]).toBe("显示楼层");
    expect(core.canvas.ui["!type"]).toBe("CanvasRenderingContext2D");
    expect(core.enemys.hasSpecial["!doc"]).toContain("先攻(1)");
    expect(core.enemys.hasSpecial["!doc"]).toContain("动态名称(6)");
  });

  it("exposes project functions and plugin members to real Tern queries", async () => {
    const bundle = buildTernDefinitionBundle(inputs());
    const server = new Server({ defs: bundle.defs });
    for (const document of bundle.documents) server.addFile(document.name, document.text);

    await expect(requestCompletions(server, "core.cust")).resolves.toContain("customEvent");
    await expect(requestCompletions(server, "core.plugin.customP")).resolves.toContain("customPlugin");
  });

  it("reports invalid project source without losing base definitions", () => {
    const source = inputs();
    source.plugins.broken = "not a function";
    const bundle = buildTernDefinitionBundle(source);

    expect(bundle.defs).toHaveLength(3);
    expect(bundle.diagnostics.some((item) => item.source === "tern:plugins.broken")).toBe(true);
  });
});
