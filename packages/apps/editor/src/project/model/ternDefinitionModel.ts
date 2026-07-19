import { computed, effect } from "alien-signals";
import { parseExpressionAt } from "acorn";
import * as walk from "acorn-walk";
import type * as Tern from "tern";
import type { Content } from "@/fs/types";
import type { ReadonlySignal } from "@/fs/interfaces";
import { ContentUtils } from "@/fs/ContentUtils";
import { waitUntil } from "@/utils/base/signal";
import { projectData } from "@/project/data/projectData";
import { MATERIAL_SHEET_IMAGES, projectAssets } from "@/project/assets";
import { ternDefsService, type TernDefsData } from "@/services/ternDefs";
import type { TowerData } from "@/services/tower";
import type { ItemsData } from "@/services/item";
import type { EnemysData } from "@/services/enemy";
import type { FunctionsData } from "@/services/functions";
import type { PluginsData } from "@/services/plugins";
import type { CommentObject } from "@/components/Table";
import type { FloorData } from "@/types";
import type { ModelResource, ProjectDiagnostic } from "./projectModel";
import type {
  DataCommentType,
  TernCoreDef,
  TernTypeEntry,
} from "@/Workbench/CodeEditor/types/index";
import {
  buildAnimatesDef,
  buildBgmsDef,
  buildEnemysDef,
  buildFlagsDef,
  buildItemsDef,
  buildMapsDef,
  buildShopsDef,
  buildSoundsDef,
  buildValuesDef,
} from "@/Workbench/CodeEditor/utils/ternDefinitions";

export interface TernDefinitionDocument {
  name: string;
  text: string;
}

export interface TernDefinitionBundle {
  defs: Tern.Def[];
  documents: TernDefinitionDocument[];
  diagnostics: ProjectDiagnostic[];
}

export interface TernDefinitionInputs {
  baseDefs: TernDefsData;
  tower: TowerData;
  items: ItemsData;
  enemys: EnemysData;
  functions: FunctionsData;
  plugins: PluginsData;
  dataComment: CommentObject;
  floors: Array<{ id: string; floor: FloorData }>;
  autotiles: string[];
  diagnostics: ProjectDiagnostic[];
}

interface FunctionExpressionNode {
  type: "FunctionExpression" | "ArrowFunctionExpression";
  body: { type: string };
  params: Array<{ type?: string; name?: string; argument?: { name?: string } }>;
  start: number;
  end: number;
}

interface AssignmentNode {
  left?: {
    type: string;
    computed?: boolean;
    object?: { type?: string };
    property?: { type?: string; name?: string; value?: unknown };
  };
  right?: FunctionExpressionNode;
}

interface ReturnNode {
  argument?: ArrayNode | null;
}

interface ArrayNode {
  type: "ArrayExpression";
  elements: Array<LiteralNode | ArrayNode | FunctionExpressionNode | null>;
}

interface LiteralNode {
  type: "Literal";
  value: unknown;
}

const STANDARD_CANVASES = [
  "bg",
  "event",
  "hero",
  "event2",
  "fg",
  "damage",
  "animate",
  "curtain",
  "ui",
  "data",
] as const;

const IDLE_CONTENT: Content<TernDefinitionBundle> = { status: "idle" };
const LOADING_CONTENT: Content<TernDefinitionBundle> = { status: "loading" };

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseFunctionSource(source: string): FunctionExpressionNode {
  const expression = parseExpressionAt(source, 0, { ecmaVersion: "latest" });
  if (expression.type !== "FunctionExpression" && expression.type !== "ArrowFunctionExpression") {
    throw new Error("Expected a function expression");
  }
  return expression as unknown as FunctionExpressionNode;
}

function functionStub(node: FunctionExpressionNode): string {
  const parameters = node.params.map((parameter, index) => {
    if (parameter.type === "Identifier" && parameter.name) return parameter.name;
    if (parameter.type === "RestElement" && parameter.argument?.name) return parameter.argument.name;
    return `arg${index}`;
  });
  return `function (${parameters.join(", ")}) {}`;
}

function appendSpecialDocs(coredef: TernCoreDef, source: unknown, diagnostics: ProjectDiagnostic[]): void {
  if (typeof source !== "string") return;
  try {
    const expression = parseFunctionSource(source);
    let returned: ArrayNode | undefined;
    walk.simple(expression as never, {
      ReturnStatement(node: unknown) {
        const argument = (node as ReturnNode).argument;
        if (argument?.type === "ArrayExpression" && !returned) returned = argument;
      },
    });
    if (!returned) return;

    const labels: string[] = [];
    for (const element of returned.elements) {
      if (element?.type !== "ArrayExpression") continue;
      const idNode = element.elements[0];
      const nameNode = element.elements[1];
      if (idNode?.type !== "Literal" || typeof idNode.value !== "number") continue;
      const name = nameNode?.type === "Literal" && typeof nameNode.value === "string"
        ? nameNode.value
        : "动态名称";
      labels.push(`${name}(${idNode.value})`);
    }
    if (labels.length > 0) {
      const target = coredef.core.enemys.hasSpecial;
      const prefix = target["!doc"] || "";
      target["!doc"] = `${prefix}${prefix ? "<br/>" : ""}${labels.join("; ")};`;
    }
  } catch (error) {
    diagnostics.push({
      source: "tern:functions.enemys.getSpecials",
      severity: "warning",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function collectFunctionDocuments(
  data: FunctionsData,
  diagnostics: ProjectDiagnostic[],
): TernDefinitionDocument[] {
  const lines: string[] = [];

  const visit = (value: FunctionsData, path: string[]) => {
    for (const [key, child] of Object.entries(value)) {
      const nextPath = [...path, key];
      if (typeof child === "string") {
        try {
          const expression = parseFunctionSource(child);
          const target = nextPath.reduce((result, part) => `${result}[${JSON.stringify(part)}]`, "core");
          lines.push(`${target} = ${functionStub(expression)};`);
          lines.push(`core[${JSON.stringify(key)}] = ${target};`);
        } catch (error) {
          diagnostics.push({
            source: `tern:functions.${nextPath.join(".")}`,
            severity: "warning",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        visit(child, nextPath);
      }
    }
  };

  visit(data, []);
  return lines.length > 0 ? [{ name: "project-functions.js", text: lines.join("\n") }] : [];
}

function collectPluginDocuments(
  data: PluginsData,
  diagnostics: ProjectDiagnostic[],
): TernDefinitionDocument[] {
  const lines: string[] = [];
  for (const [key, source] of Object.entries(data)) {
    if (typeof source !== "string") continue;
    try {
      const expression = parseFunctionSource(source);
      walk.simple(expression as never, {
        AssignmentExpression(node: unknown) {
          const assignment = node as AssignmentNode;
          const left = assignment.left;
          const right = assignment.right;
          if (left?.type !== "MemberExpression" || left.object?.type !== "ThisExpression") return;
          if (right?.type !== "FunctionExpression" && right?.type !== "ArrowFunctionExpression") return;
          const property = left.property;
          const name = left.computed
            ? property?.value
            : property?.name;
          if (typeof name !== "string") return;
          lines.push(
            `core.plugin[${JSON.stringify(name)}] = ${functionStub(right)};`,
          );
        },
      });
    } catch (error) {
      diagnostics.push({
        source: `tern:plugins.${key}`,
        severity: "warning",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return lines.length > 0 ? [{ name: "project-plugins.js", text: lines.join("\n") }] : [];
}

function addImageDefinitions(coredef: TernCoreDef, tower: TowerData, autotiles: string[]): void {
  const material = coredef.core.material.images;
  for (const name of MATERIAL_SHEET_IMAGES) {
    material[name] = { "!type": "image", "!doc": "系统图片" };
  }

  const addCategory = (category: string, names: string[], doc: string) => {
    const entry: TernTypeEntry = { "!doc": doc };
    for (const name of names) entry[name] = { "!type": "image" };
    material[category] = entry;
  };

  addCategory("images", stringArray(tower.main.images), "自定义图片");
  addCategory("autotile", autotiles, "自动元件");
  addCategory("tilesets", stringArray(tower.main.tilesets), "额外素材");
}

function addCanvasDefinitions(coredef: TernCoreDef): void {
  for (const name of STANDARD_CANVASES) {
    coredef.core.canvas[name] = {
      "!type": "CanvasRenderingContext2D",
      "!doc": "系统画布",
    };
  }
}

export function buildTernDefinitionBundle(inputs: TernDefinitionInputs): TernDefinitionBundle {
  const diagnostics = [...inputs.diagnostics];
  const defs = structuredClone(inputs.baseDefs) as Tern.Def[];
  const coredef = defs[2] as unknown as TernCoreDef | undefined;
  if (!coredef?.core?.material || !coredef.core.status) {
    throw new Error("Invalid mota-js Tern base definitions");
  }

  buildEnemysDef(coredef, inputs.enemys);
  buildItemsDef(coredef, inputs.items);
  buildBgmsDef(coredef, Object.fromEntries(stringArray(inputs.tower.main.bgms).map((name) => [name, {}])));
  buildSoundsDef(coredef, Object.fromEntries(stringArray(inputs.tower.main.sounds).map((name) => [name, {}])));
  buildAnimatesDef(coredef, Object.fromEntries(stringArray(inputs.tower.main.animates).map((name) => [name, {}])));
  addImageDefinitions(coredef, inputs.tower, inputs.autotiles);
  addCanvasDefinitions(coredef);
  buildMapsDef(coredef, Object.fromEntries(inputs.floors.map(({ id, floor }) => [id, floor])));

  const shops = Array.isArray(inputs.tower.firstData.shops) ? inputs.tower.firstData.shops : [];
  buildShopsDef(coredef, Object.fromEntries(
    shops
      .filter((shop): shop is { id: string; textInList?: string } => (
        typeof shop === "object" && shop !== null && typeof (shop as { id?: unknown }).id === "string"
      ))
      .map((shop) => [shop.id, shop]),
  ));

  buildValuesDef(coredef, inputs.tower.values ?? {}, inputs.dataComment as unknown as DataCommentType);
  buildFlagsDef(coredef, inputs.tower.flags ?? {}, inputs.dataComment as unknown as DataCommentType);
  appendSpecialDocs(
    coredef,
    (inputs.functions.enemys as FunctionsData | undefined)?.getSpecials,
    diagnostics,
  );

  return {
    defs,
    documents: [
      ...collectFunctionDocuments(inputs.functions, diagnostics),
      ...collectPluginDocuments(inputs.plugins, diagnostics),
    ],
    diagnostics,
  };
}

function diagnostic(source: string, content: Content<unknown>): ProjectDiagnostic | undefined {
  if (content.status === "error") {
    return { source, severity: "warning", message: content.error.message };
  }
  if (content.status === "not-found") {
    return { source, severity: "warning", message: `${source} not found` };
  }
  return undefined;
}

function relevantFingerprint(inputs: TernDefinitionInputs, baseRevision: number): string {
  return JSON.stringify({
    baseRevision,
    main: {
      bgms: inputs.tower.main.bgms,
      sounds: inputs.tower.main.sounds,
      animates: inputs.tower.main.animates,
      images: inputs.tower.main.images,
      tilesets: inputs.tower.main.tilesets,
      floorIds: inputs.tower.main.floorIds,
    },
    shops: inputs.tower.firstData.shops,
    values: inputs.tower.values,
    flags: inputs.tower.flags,
    items: inputs.items,
    enemys: inputs.enemys,
    functions: inputs.functions,
    plugins: inputs.plugins,
    dataComment: inputs.dataComment,
    floors: inputs.floors.map(({ id, floor }) => ({ id, title: floor.title, name: floor.name })),
    autotiles: inputs.autotiles,
    diagnostics: inputs.diagnostics,
  });
}

export class TernDefinitionModelResource implements ModelResource<TernDefinitionBundle> {
  readonly id = "ternDefinitions";
  readonly content: ReadonlySignal<Content<TernDefinitionBundle>>;
  private cachedFingerprint = "";
  private cachedContent: Content<TernDefinitionBundle> | null = null;
  private baseDefsRef: TernDefsData | null = null;
  private baseRevision = 0;

  constructor() {
    this.content = computed(() => this.compute());
  }

  private compute(): Content<TernDefinitionBundle> {
    const base = ternDefsService.getHandler().content();
    if (base.status === "idle") return IDLE_CONTENT;
    if (base.status === "loading") return LOADING_CONTENT;
    if (base.status !== "loaded") return base as Content<TernDefinitionBundle>;
    if (this.baseDefsRef !== base.value) {
      this.baseDefsRef = base.value;
      this.baseRevision += 1;
    }

    const tower = projectData.tower().content();
    const items = projectData.items().content();
    const enemys = projectData.enemys().content();
    const functions = projectData.functions().content();
    const plugins = projectData.plugins().content();
    const dataComment = projectData.tableMetaSource("dataComment").content();
    const autotiles = projectAssets.materialCollection("autotile").content();
    const optional = [tower, items, enemys, functions, plugins, dataComment, autotiles];
    if (optional.some((content) => content.status === "idle")) return IDLE_CONTENT;
    if (optional.some((content) => content.status === "loading")) return LOADING_CONTENT;

    const diagnostics = [
      diagnostic("project/data.js", tower),
      diagnostic("project/items.js", items),
      diagnostic("project/enemys.js", enemys),
      diagnostic("project/functions.js", functions),
      diagnostic("project/plugins.js", plugins),
      diagnostic("_server/table/data.comment.js", dataComment),
      diagnostic("project/autotiles", autotiles),
    ].filter((item): item is ProjectDiagnostic => Boolean(item));

    const towerValue = tower.status === "loaded"
      ? tower.value
      : { main: { floorIds: [] }, firstData: { floorId: "" }, values: {}, flags: {} };
    const floorContents = towerValue.main.floorIds.map((id) => ({ id, content: projectData.floor(id).content() }));
    if (floorContents.some(({ content }) => content.status === "idle")) return IDLE_CONTENT;
    if (floorContents.some(({ content }) => content.status === "loading")) return LOADING_CONTENT;

    for (const { id, content } of floorContents) {
      const item = diagnostic(`project/floors/${id}.js`, content);
      if (item) diagnostics.push(item);
    }

    const inputs: TernDefinitionInputs = {
      baseDefs: base.value,
      tower: towerValue,
      items: items.status === "loaded" ? items.value : {},
      enemys: enemys.status === "loaded" ? enemys.value : {},
      functions: functions.status === "loaded" ? functions.value : {},
      plugins: plugins.status === "loaded" ? plugins.value : {},
      dataComment: dataComment.status === "loaded" ? dataComment.value : ({ _data: {} } as CommentObject),
      floors: floorContents.flatMap(({ id, content }) => content.status === "loaded" ? [{ id, floor: content.value }] : []),
      autotiles: autotiles.status === "loaded"
        ? autotiles.value.entries.flatMap((entry) => entry.slot.kind === "file" ? [entry.slot.name] : [])
        : [],
      diagnostics,
    };
    const fingerprint = relevantFingerprint(inputs, this.baseRevision);
    if (fingerprint === this.cachedFingerprint && this.cachedContent) return this.cachedContent;

    try {
      this.cachedFingerprint = fingerprint;
      this.cachedContent = { status: "loaded", value: buildTernDefinitionBundle(inputs) };
    } catch (error) {
      this.cachedContent = {
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    return this.cachedContent;
  }

  snapshot(): Content<TernDefinitionBundle> {
    return this.content();
  }

  value(): TernDefinitionBundle {
    return ContentUtils.unwrap(this.content(), this.id);
  }

  async reload(): Promise<void> {
    await Promise.all([
      ternDefsService.refetch(),
      projectData.tower().reload(),
      projectData.items().reload(),
      projectData.enemys().reload(),
      projectData.functions().reload(),
      projectData.plugins().reload(),
      projectData.tableMetaSource("dataComment").reload(),
      projectAssets.materialCollection("autotile").reload(),
    ]);
    const tower = projectData.tower().content();
    if (tower.status === "loaded") {
      await Promise.all(tower.value.main.floorIds.map((id) => projectData.floor(id).reload()));
    }
  }

  async ensureLoaded(): Promise<void> {
    const base = ternDefsService.getHandler();
    await Promise.all([
      base.getContent().status === "idle" ? base.refetch() : base.waitForSettled(),
      projectData.tower().ensureLoaded(),
      projectData.items().ensureLoaded(),
      projectData.enemys().ensureLoaded(),
      projectData.functions().ensureLoaded(),
      projectData.plugins().ensureLoaded(),
      projectData.tableMetaSource("dataComment").ensureLoaded(),
      projectAssets.materialCollection("autotile").ensureLoaded(),
    ]);
    const tower = projectData.tower().content();
    if (tower.status === "loaded") {
      await Promise.all(tower.value.main.floorIds.map((id) => projectData.floor(id).ensureLoaded()));
    }
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => {
      const status = this.content().status;
      return status !== "idle" && status !== "loading";
    });
  }

  subscribe(listener: (content: Content<TernDefinitionBundle>) => void): () => void {
    return effect(() => listener(this.content()));
  }
}
