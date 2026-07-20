import { parseExpressionAt } from "acorn";
import type { CommentObject } from "@/components/Table";
import type { Content } from "@/fs/types";
import { projectData } from "@/project/data/projectData";
import { projectAssets } from "@/project/assets";
import { computedResource } from "@/project/resources";
import { META_FILE_CONFIG, type MetaFileKey } from "@/services/tableMeta";
import { createTableMetaRuntimeContext } from "@/project/tableMeta/TableMetaRuntimeContext";
import { parseTableMetaSource } from "@/project/tableMeta/TableMetaEvaluator";
import type { ModelResource, ProjectDiagnostic } from "./projectModel";

export interface EnemySpecialDefinition {
  id: string | number;
  name: string;
  dynamic: boolean;
}

export interface EnemySpecialCatalog {
  entries: EnemySpecialDefinition[];
  diagnostics: ProjectDiagnostic[];
}

export interface ProjectImageEntry {
  name: string;
  path: string;
  kind: "physical" | "split";
  crop?: { x: number; y: number; width: number; height: number };
}

export interface ProjectImageCatalog {
  entries: ProjectImageEntry[];
  diagnostics: ProjectDiagnostic[];
}

export interface TableSchemaBundle {
  schema: CommentObject;
  diagnostics: ProjectDiagnostic[];
}

type Node = Record<string, any>;

function functionExpression(source: string): Node | undefined {
  try {
    return parseExpressionAt(`(${source})`, 0, { ecmaVersion: "latest" }) as unknown as Node;
  } catch {
    try {
      return parseExpressionAt(source, 0, { ecmaVersion: "latest" }) as unknown as Node;
    } catch {
      return undefined;
    }
  }
}

function returnedExpression(fn: Node): Node | undefined {
  if (fn.body?.type !== "BlockStatement") return fn.body;
  return fn.body.body.find((statement: Node) => statement.type === "ReturnStatement")?.argument;
}

function safeValue(node: Node | undefined, env: Record<string, unknown>): unknown {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "Identifier") return env[node.name];
  if (node.type === "ObjectExpression") return Object.fromEntries(node.properties.flatMap((property: Node) => {
    if (property.type !== "Property") return [];
    const key = property.key.name ?? property.key.value;
    return [[String(key), safeValue(property.value, env)]];
  }));
  if (node.type === "MemberExpression") {
    const object = safeValue(node.object, env);
    const property = node.computed ? safeValue(node.property, env) : node.property.name;
    return object && typeof object === "object" ? (object as Record<PropertyKey, unknown>)[property as PropertyKey] : undefined;
  }
  if (node.type === "LogicalExpression") {
    const left = safeValue(node.left, env);
    if (node.operator === "||") return left || safeValue(node.right, env);
    if (node.operator === "&&") return left && safeValue(node.right, env);
    if (node.operator === "??") return left ?? safeValue(node.right, env);
  }
  if (node.type === "BinaryExpression") {
    const left = safeValue(node.left, env) as any;
    const right = safeValue(node.right, env) as any;
    if (node.operator === "+") return left + right;
    if (node.operator === "-") return left - right;
    if (node.operator === "*") return left * right;
    if (node.operator === "/") return left / right;
  }
  if (node.type === "ConditionalExpression") {
    return safeValue(node.test, env) ? safeValue(node.consequent, env) : safeValue(node.alternate, env);
  }
  return undefined;
}

export function buildEnemySpecialCatalog(functions: Record<string, unknown>): EnemySpecialCatalog {
  const diagnostics: ProjectDiagnostic[] = [];
  const source = (functions.enemys as Record<string, unknown> | undefined)?.getSpecials;
  if (typeof source !== "string") {
    return {
      entries: [],
      diagnostics: [{ source: "enemy-specials", severity: "warning", message: "enemys.getSpecials is unavailable" }],
    };
  }
  const fn = functionExpression(source);
  const returned = fn && returnedExpression(fn);
  if (!returned || returned.type !== "ArrayExpression") {
    return {
      entries: [],
      diagnostics: [{ source: "enemy-specials", severity: "warning", message: "Cannot statically parse enemys.getSpecials" }],
    };
  }
  const entries = returned.elements.flatMap((row: Node | null, index: number): EnemySpecialDefinition[] => {
    if (!row || row.type !== "ArrayExpression") {
      diagnostics.push({
        source: `enemy-specials:${index}`,
        severity: "warning",
        message: `enemys.getSpecials 第 ${index + 1} 项为空或不是数组；旧编辑器会在读取该项时失败`,
      });
      return [];
    }
    const id = safeValue(row.elements[0], {});
    if (typeof id !== "string" && typeof id !== "number") {
      diagnostics.push({
        source: `enemy-specials:${index}`,
        severity: "warning",
        message: `enemys.getSpecials 第 ${index + 1} 项缺少合法的特殊属性 ID`,
      });
      return [];
    }
    const nameNode = row.elements[1];
    const literalName = safeValue(nameNode, {});
    if (typeof literalName === "string") return [{ id, name: literalName, dynamic: false }];
    if (["FunctionExpression", "ArrowFunctionExpression"].includes(nameNode?.type)) {
      const parameter = nameNode.params?.[0]?.name ?? "enemy";
      const resolved = safeValue(returnedExpression(nameNode), { [parameter]: {} });
      if (typeof resolved === "string") return [{ id, name: resolved, dynamic: true }];
    }
    diagnostics.push({
      source: `enemy-specials:${String(id)}`,
      severity: "info",
      message: `Special ${String(id)} has a runtime-dependent name`,
    });
    return [{ id, name: `动态名称(${String(id)})`, dynamic: true }];
  });
  return { entries, diagnostics };
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function splitDefinitions(tower: Record<string, unknown>): Array<Record<string, unknown>> {
  const main = tower.main as Record<string, unknown> | undefined;
  return Array.isArray(main?.splitImages)
    ? main.splitImages.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

export function projectImageCatalogContent(): Content<ProjectImageCatalog> {
  const tower = projectData.tower().content();
  const directory = projectAssets.directory("project/images").content();
  if ([tower.status, directory.status].includes("loading")) return { status: "loading" };
  if ([tower.status, directory.status].includes("idle")) return { status: "idle" };
  const diagnostics: ProjectDiagnostic[] = [];
  if (tower.status === "error") diagnostics.push({
    source: "project-images:tower",
    severity: "warning",
    message: tower.error.message,
  });
  if (directory.status === "error") diagnostics.push({
    source: "project-images:directory",
    severity: "warning",
    message: directory.error.message,
  });
  const physicalNames = directory.status === "loaded"
    ? directory.value.entries.filter((name) => /\.(png|jpe?g|gif)$/i.test(name))
    : [];
  const entries: ProjectImageEntry[] = physicalNames.map((name) => ({
    name,
    path: `project/images/${name}`,
    kind: "physical",
  }));
  const names = new Set(entries.map((entry) => entry.name));
  const towerValue = tower.status === "loaded" ? tower.value as unknown as Record<string, unknown> : {};
  for (const definition of splitDefinitions(towerValue)) {
    const sourceName = typeof definition.name === "string" ? definition.name : "";
    const width = Number(definition.width);
    const height = Number(definition.height);
    const prefix = typeof definition.prefix === "string" ? definition.prefix : "";
    if (!sourceName || !prefix || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      diagnostics.push({ source: "project-images:split", severity: "warning", message: "Invalid splitImages entry" });
      continue;
    }
    const source = projectAssets.image(`project/images/${sourceName}`).content();
    if (source.status === "idle" || source.status === "loading") return { status: source.status };
    if (source.status !== "loaded") {
      diagnostics.push({ source: `project-images:${sourceName}`, severity: "warning", message: `Split image source ${sourceName} is unavailable` });
      continue;
    }
    const size = pngSize(source.value.bytes);
    if (!size) {
      diagnostics.push({ source: `project-images:${sourceName}`, severity: "warning", message: `Split image source ${sourceName} is not a PNG` });
      continue;
    }
    let index = 0;
    for (let y = 0; y < size.height; y += height) {
      for (let x = 0; x < size.width; x += width) {
        const name = `${prefix}${index++}.png`;
        if (names.has(name)) {
          diagnostics.push({ source: `project-images:${name}`, severity: "warning", message: `Logical image ${name} conflicts with another image` });
          continue;
        }
        names.add(name);
        entries.push({
          name,
          path: `project/images/${sourceName}`,
          kind: "split",
          crop: { x, y, width: Math.min(width, size.width - x), height: Math.min(height, size.height - y) },
        });
      }
    }
  }
  return { status: "loaded", value: { entries, diagnostics } };
}

export function createEnemySpecialResource(): ModelResource<EnemySpecialCatalog> {
  return computedResource("enemySpecialCatalog", [projectData.functions()], () => {
    const content = projectData.functions().content();
    if (content.status === "idle" || content.status === "loading") return content as Content<EnemySpecialCatalog>;
    if (content.status !== "loaded") return {
      status: "loaded",
      value: {
        entries: [],
        diagnostics: [{
          source: "enemy-specials",
          severity: "warning",
          message: content.status === "error" ? content.error.message : "functions.js is unavailable",
        }],
      },
    };
    return { status: "loaded", value: buildEnemySpecialCatalog(content.value) };
  });
}

export function createProjectImageResource(): ModelResource<ProjectImageCatalog> {
  const dependencies = () => {
    const tower = projectData.tower();
    const directory = projectAssets.directory("project/images");
    const towerContent = tower.content();
    if (towerContent.status !== "loaded") return [tower, directory];
    const sources = splitDefinitions(towerContent.value as unknown as Record<string, unknown>)
      .flatMap((definition) => typeof definition.name === "string" && definition.name
        ? [projectAssets.image(`project/images/${definition.name}`)]
        : []);
    return [tower, directory, ...sources];
  };
  const reloadDependencies = () => dependencies().filter((dependency) => dependency !== projectData.tower());
  return computedResource(
    "projectImageCatalog",
    dependencies,
    projectImageCatalogContent,
    reloadDependencies,
  );
}

export function createTableSchemaResource(
  key: MetaFileKey,
  specials: ModelResource<EnemySpecialCatalog>,
  images: ModelResource<ProjectImageCatalog>,
): ModelResource<TableSchemaBundle> {
  return computedResource(`tableSchema:${key}`, [
    projectData.tableMetaSource(key), projectData.tower(), specials, images,
  ], () => {
    const raw = projectData.tableMetaSource(key).raw().content();
    if (raw.status !== "loaded") return raw as Content<TableSchemaBundle>;
    if (!["comment", "dataComment"].includes(key)) {
      try {
        return {
          status: "loaded",
          value: {
            schema: parseTableMetaSource(raw.value, META_FILE_CONFIG[key].varName, createTableMetaRuntimeContext()),
            diagnostics: [],
          },
        };
      } catch (error) {
        return { status: "error", error: error instanceof Error ? error : new Error(String(error)) };
      }
    }
    const tower = projectData.tower().content();
    const specialContent = specials.content();
    const imageContent = images.content();
    if ([tower.status, specialContent.status, imageContent.status].includes("loading")) return { status: "loading" };
    if ([tower.status, specialContent.status, imageContent.status].includes("idle")) return { status: "idle" };
    const specialValue = specialContent.status === "loaded" ? specialContent.value : { entries: [], diagnostics: [] };
    const imageValue = imageContent.status === "loaded" ? imageContent.value : { entries: [], diagnostics: [] };
    const towerValue = tower.status === "loaded" ? tower.value : { main: { floorIds: [] }, firstData: { floorId: "" } };
    const main = towerValue.main as Record<string, unknown>;
    const dependencyDiagnostics: ProjectDiagnostic[] = [];
    if (tower.status === "error") dependencyDiagnostics.push({ source: "table-schema:tower", severity: "warning", message: tower.error.message });
    if (tower.status === "not-found") dependencyDiagnostics.push({ source: "table-schema:tower", severity: "warning", message: "project/data.js is unavailable" });
    const context = createTableMetaRuntimeContext({
      data: towerValue as unknown as Record<string, unknown>,
      images: {
        images: imageValue.entries.map((entry) => entry.name),
        tilesets: Array.isArray(main.tilesets) ? main.tilesets.filter((name): name is string => typeof name === "string") : [],
        animates: Array.isArray(main.animates) ? main.animates.filter((name): name is string => typeof name === "string") : [],
        bgms: Array.isArray(main.bgms) ? main.bgms.filter((name): name is string => typeof name === "string") : [],
        sounds: Array.isArray(main.sounds) ? main.sounds.filter((name): name is string => typeof name === "string") : [],
      },
      specials: specialValue.entries.map((entry) => [entry.id, entry.name]),
    });
    try {
      return {
        status: "loaded",
        value: {
          schema: parseTableMetaSource(raw.value, META_FILE_CONFIG[key].varName, context),
          diagnostics: [...dependencyDiagnostics, ...specialValue.diagnostics, ...imageValue.diagnostics],
        },
      };
    } catch (error) {
      return { status: "error", error: error instanceof Error ? error : new Error(String(error)) };
    }
  });
}
