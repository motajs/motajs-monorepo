import { decodeGameData2x } from "@motajs/file2x";

type TernEntry = Record<string, unknown>;

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[^A-Za-z_$]/, "_$&");
}

function splitTopLevel(source: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (["(", "[", "{"].includes(char)) depth += 1;
    else if ([")", "]", "}"].includes(char)) depth -= 1;
    else if (char === separator && depth === 0) {
      result.push(source.slice(start, index));
      start = index + 1;
    }
  }
  result.push(source.slice(start));
  return result;
}

function functionType(source: string, aliases: ReadonlySet<string>): string | undefined {
  if (!source.startsWith("fn(")) return undefined;
  let depth = 0;
  let close = -1;
  for (let index = 2; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")" && --depth === 0) {
      close = index;
      break;
    }
  }
  if (close < 0) return "(...args: any[]) => any";
  const parameters = splitTopLevel(source.slice(3, close), ",").filter((item) => item.trim()).map((item, index) => {
    const colon = item.indexOf(":");
    // Tern also accepts anonymous parameters such as `fn(string|CanvasRenderingContext2D)`.
    // Treat the whole item as its type instead of silently dropping it to any.
    if (colon < 0) return `arg${index}: ${ternType(item.trim(), aliases)}`;
    const rawName = item.slice(0, colon).trim();
    const optional = rawName.endsWith("?");
    const rest = rawName.startsWith("...");
    const name = safeName(rawName.replace(/^\.\.\./, "").replace(/\?$/, "") || `arg${index}`);
    const type = ternType(item.slice(colon + 1).trim(), aliases);
    return `${rest ? "..." : ""}${name}${optional ? "?" : ""}: ${rest ? `${type}[]` : type}`;
  });
  const arrow = source.slice(close + 1).match(/^\s*->\s*(.+)$/);
  return `(${parameters.join(", ")}) => ${arrow ? ternType(arrow[1], aliases) : "void"}`;
}

function ternType(source: string, aliases: ReadonlySet<string>): string {
  const normalized = source.trim();
  const fn = functionType(normalized, aliases);
  if (fn) return fn;
  const union = splitTopLevel(normalized, "|");
  if (union.length > 1) return union.map((item) => {
    const type = ternType(item, aliases);
    return type.includes("=>") ? `(${type})` : type;
  }).join(" | ");
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const item = normalized.slice(1, -1).trim();
    return item ? `Array<${ternType(item, aliases)}>` : "any[]";
  }
  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    const fields = splitTopLevel(normalized.slice(1, -1), ",").filter((item) => item.trim());
    return `{ ${fields.map((field, index) => {
      const colon = field.indexOf(":");
      if (colon < 0) return `${JSON.stringify(`field${index}`)}: any`;
      const rawName = field.slice(0, colon).trim();
      const optional = rawName.endsWith("?");
      const name = rawName.replace(/\?$/, "");
      return `${JSON.stringify(name)}${optional ? "?" : ""}: ${ternType(field.slice(colon + 1), aliases)}`;
    }).join("; ")} }`;
  }
  const bare = normalized.replace(/^\+/, "");
  if (["?", "any", "unknown"].includes(bare)) return "any";
  if (bare === "bool") return "boolean";
  if (["number", "string", "boolean", "void", "null", "undefined", "never"].includes(bare)) return bare;
  if (aliases.has(bare)) return `__MotaTern_${safeName(bare)}`;
  // The template still uses the historical public name `heroStatus` for the
  // global shortcut, while the actual structure is stored as `!define.hero`.
  if (bare === "heroStatus" && aliases.has("hero")) return "__MotaTern_hero";
  if (["CanvasRenderingContext2D", "Storage"].includes(bare) || /^[A-Z][\w$]*$/.test(bare)) return bare;
  return "any";
}

function doc(entry: TernEntry, indent: string): string {
  if (typeof entry["!doc"] !== "string" || !entry["!doc"].trim()) return "";
  const lines = entry["!doc"].replace(/<br\s*\/?>/gi, "\n").replace(/\*\//g, "* /").split("\n");
  return `${indent}/** ${lines.map((line) => line.trim()).join(`\n${indent} * `)} */\n`;
}

function entryType(entry: unknown, aliases: ReadonlySet<string>, indent = ""): string {
  if (typeof entry === "string") return ternType(entry, aliases);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "any";
  const object = entry as TernEntry;
  const declared = typeof object["!type"] === "string" ? ternType(object["!type"], aliases) : undefined;
  const properties = Object.entries(object).filter(([key]) => !key.startsWith("!") && key !== "prototype");
  if (properties.length === 0) return declared ?? "Record<string, any>";
  const nextIndent = `${indent}  `;
  const body = properties.map(([key, value]) => {
    const child = value && typeof value === "object" && !Array.isArray(value) ? value as TernEntry : {};
    return `${doc(child, nextIndent)}${nextIndent}${JSON.stringify(key)}: ${entryType(value, aliases, nextIndent)};`;
  }).join("\n");
  const shape = `{\n${body}\n${indent}}`;
  return declared ? `${declared} & ${shape}` : shape;
}

export interface TernDeclarationResult {
  declaration: string;
  diagnostics: string[];
}

export function buildTernDeclaration(source: string): TernDeclarationResult {
  const decoded = decodeGameData2x<unknown[]>(source).data;
  const coreDefinition = decoded.find((value) => (
    value && typeof value === "object" && (value as TernEntry)["!name"] === "core"
  )) as TernEntry | undefined;
  if (!coreDefinition || !coreDefinition.core) throw new Error("Tern core definition is missing");
  const definitions = coreDefinition["!define"] && typeof coreDefinition["!define"] === "object"
    ? coreDefinition["!define"] as TernEntry
    : {};
  const aliases = new Set(Object.keys(definitions));
  const diagnostics: string[] = [];
  const safeAliases = new Map<string, string>();
  for (const name of aliases) {
    const safe = safeName(name);
    const previous = safeAliases.get(safe);
    if (previous && previous !== name) diagnostics.push(`类型名 ${previous} 与 ${name} 转换后冲突`);
    else safeAliases.set(safe, name);
  }
  const parts = Object.entries(definitions).map(([name, entry]) => (
    `type __MotaTern_${safeName(name)} = ${entryType(entry, aliases)};`
  ));
  parts.push(`type __MotaTernCore = ${entryType(coreDefinition.core, aliases)};`);
  for (const [name, entry] of Object.entries(coreDefinition)) {
    if (name.startsWith("!") || name === "core") continue;
    const declarationKind = ["hero", "flags"].includes(name) ? "let" : "const";
    parts.push(`${doc(entry as TernEntry, "")}declare ${declarationKind} ${safeName(name)}: ${entryType(entry, aliases)};`);
  }
  return { declaration: parts.join("\n\n"), diagnostics };
}
