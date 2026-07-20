import { describe, expect, it } from "vitest";
import { buildEnemySpecialCatalog } from "../tableModels";
import {
  createTableMetaRuntimeContext,
} from "@/project/tableMeta/TableMetaRuntimeContext";
import {
  callTableMetaFunctionString,
  evaluateTableMetaExpression,
  getTableMetaContext,
  parseTableMetaSource,
} from "@/project/tableMeta/TableMetaEvaluator";

describe("table project models", () => {
  it("extracts literal, simple dynamic, and unresolved enemy special names without execution", () => {
    const catalog = buildEnemySpecialCatalog({
      enemys: {
        getSpecials: `function () { return [
          [1, "先攻"],
          [6, function (enemy) { return (enemy.n || '') + "连击"; }],
          [7, function (enemy) { return helper(enemy); }]
        ]; }`,
      },
    });
    expect(catalog.entries).toEqual([
      { id: 1, name: "先攻", dynamic: false },
      { id: 6, name: "连击", dynamic: true },
      { id: 7, name: "动态名称(7)", dynamic: true },
    ]);
    expect(catalog.diagnostics).toHaveLength(1);
  });

  it("diagnoses sparse or invalid enemy special rows without hiding the valid rows", () => {
    const catalog = buildEnemySpecialCatalog({
      enemys: {
        getSpecials: `function () { return [
          [1, "先攻"],
          ,
          [null, "无效项"],
          [2, "魔攻"]
        ]; }`,
      },
    });

    expect(catalog.entries).toEqual([
      { id: 1, name: "先攻", dynamic: false },
      { id: 2, name: "魔攻", dynamic: false },
    ]);
    expect(catalog.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "enemys.getSpecials 第 2 项为空或不是数组；旧编辑器会在读取该项时失败",
      "enemys.getSpecials 第 3 项缺少合法的特殊属性 ID",
    ]);
  });

  it("binds project context to range, checkbox and transform evaluators", () => {
    const context = createTableMetaRuntimeContext({
      data: { main: { floorIds: ["sample0", "sample1"] } },
      images: { images: ["hero.png", "dragon_0.png"] },
      specials: [[1, "先攻"], [6, "连击"]],
    });
    const schema = parseTableMetaSource(`var meta = {
      _type: 'object', _data: {
        floorIds: { _leaf: true, _range: 'editor.mode.checkFloorIds(thiseval)' },
        special: { _leaf: true, _checkboxSet: function () {
          var values = functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a.enemys.getSpecials();
          return { key: values.map(function (one) { return one[0]; }), prefix: values.map(function (one) { return one[1]; }) };
        } }
      }
    };`, "meta", context);
    const data = schema._data as Record<string, any>;
    const fieldContext = getTableMetaContext(data.floorIds);
    expect(evaluateTableMetaExpression(data.floorIds._range, ["sample0"], fieldContext).value).toBe(true);
    expect(evaluateTableMetaExpression(data.floorIds._range, ["missing"], fieldContext).value).toBe(false);
    expect(data.special._checkboxSet()).toEqual({ key: [1, 6], prefix: ["先攻", "连击"] });
    expect(callTableMetaFunctionString(
      "function (name) { return Object.keys(editor.core.material.images.images).includes(name) ? name : null; }",
      ["hero.png"],
      fieldContext,
    ).value).toBe("hero.png");
  });
});
