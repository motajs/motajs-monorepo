import { describe, expect, it } from "vitest";
import { Server } from "tern";
import type * as Tern from "tern";
import type { TernCoreDef } from "@/Workbench/CodeEditor/types";
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
      "!define": {
        CanvasRenderingContext2D: {},
      },
      "core": {
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
        events: {
          flyTo: {
            "!type": "fn(toId?: string, callback?: fn()) -> bool",
            "!doc": "飞往某一层",
          },
        },
        control: {
          clearStatus: {
            "!type": "fn()",
            "!doc": "清除游戏状态和数据",
          },
        },
        ui: {
          strokeRect: {
            "!type": "fn(name: string|CanvasRenderingContext2D, x: number, y: number, width: number, height: number, style?: string, lineWidth?: number, angle?: number)",
            "!doc": "绘制一个矩形的边框",
          },
        },
        plugin: {
          builtIn: {
            "!type": "fn(value: string) -> number",
            "!doc": "内置插件方法",
          },
        },
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
        flyTo: "function flyTo (toId, callback) { return false; }",
        clearStatus: "function clearStatus () {}",
      },
      enemys: {
        getSpecials: "function getSpecials () { return [[1, '先攻'], [6, function () { return '连击'; }]]; }",
      },
    },
    plugins: {
      custom: "function custom () { this.customPlugin = function (count) { return count; }; this.builtIn = function (value) { return 1; }; }",
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

function requestType(server: Server, source: string): Promise<{
  type?: string;
  doc?: string;
}> {
  return new Promise((resolve, reject) => {
    server.request({
      files: [{ type: "full", name: "type-test.js", text: source }],
      query: {
        type: "type",
        file: "type-test.js",
        end: source.length,
      },
    }, (error, response) => {
      if (error) reject(error);
      else resolve(response as { type?: string; doc?: string });
    });
  });
}

describe("TernDefinitionModel", () => {
  it("clones base defs and enriches them from project data", () => {
    const source = inputs();
    const original = structuredClone(source.baseDefs);
    const bundle = buildTernDefinitionBundle(source);
    const core = (bundle.defs[2] as unknown as TernCoreDef).core;

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

  it("keeps precise defs for known functions while adding project aliases", async () => {
    const bundle = buildTernDefinitionBundle(inputs());
    const projectFunctions = bundle.documents.find((document) => document.name === "project-functions.js")?.text ?? "";
    const projectPlugins = bundle.documents.find((document) => document.name === "project-plugins.js")?.text ?? "";
    const server = new Server({ defs: bundle.defs });
    for (const document of bundle.documents) server.addFile(document.name, document.text);

    expect(projectFunctions).not.toContain("core[\"events\"][\"flyTo\"] = function");
    expect(projectFunctions).not.toContain("core[\"flyTo\"] = core[\"events\"][\"flyTo\"]");
    expect(projectFunctions).toContain("core[\"events\"][\"clearStatus\"] = core[\"clearStatus\"]");
    expect(projectPlugins).not.toContain("core.plugin[\"builtIn\"]");

    await expect(requestType(server, "core.events.flyTo")).resolves.toEqual(expect.objectContaining({
      type: "fn(toId?: string, callback?: fn()) -> bool",
      doc: "飞往某一层",
    }));
    await expect(requestType(server, "core.flyTo")).resolves.toEqual(expect.objectContaining({
      type: "fn(toId?: string, callback?: fn()) -> bool",
      doc: "飞往某一层",
    }));
    await expect(requestType(server, "core.clearStatus")).resolves.toEqual(expect.objectContaining({
      type: "fn()",
      doc: "清除游戏状态和数据",
    }));
    await expect(requestType(server, "core.strokeRect")).resolves.toEqual(expect.objectContaining({
      type: "fn(name: string|CanvasRenderingContext2D, x: number, y: number, width: number, height: number, style?: string, lineWidth?: number, angle?: number)",
      doc: "绘制一个矩形的边框",
    }));
    await expect(requestType(server, "core.plugin.builtIn")).resolves.toEqual(expect.objectContaining({
      type: "fn(value: string) -> number",
      doc: "内置插件方法",
    }));
  });

  it("reports invalid project source without losing base definitions", () => {
    const source = inputs();
    source.plugins.broken = "not a function";
    const bundle = buildTernDefinitionBundle(source);

    expect(bundle.defs).toHaveLength(3);
    expect(bundle.diagnostics.some((item) => item.source === "tern:plugins.broken")).toBe(true);
  });
});
