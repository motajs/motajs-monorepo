import JSON5 from "json5";
import {
  assertIdentifier,
  File2xSyntaxError,
  parseProgram,
  readMemberPath,
  readVariableAssignment,
  significantStatements,
  type AstNode,
} from "./syntax";
import type { Encode2xOptions, GameData2x, GameMapData2x, PlainData } from "./types";

function parseData<T>(source: string, node: AstNode): T {
  try {
    return JSON5.parse(source.slice(node.start, node.end)) as T;
  } catch (error) {
    throw new File2xSyntaxError(
      `Invalid data expression: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function indent(options?: Encode2xOptions): string | number {
  return options?.indent ?? "\t";
}

export function encodeGameData2x<T>(value: GameData2x<T>, options?: Encode2xOptions): string {
  assertIdentifier(value.uuid, "variable name");
  const declaration = options?.declaration ?? "var";
  return `${declaration} ${value.uuid} =\n${JSON.stringify(value.data, null, indent(options))}`;
}

export function decodeGameData2x<T = PlainData>(source: string): GameData2x<T> {
  const { uuid, value } = readVariableAssignment(source);
  return { uuid, data: parseData<T>(source, value) };
}

export function encodeGameMapData2x<T>(value: GameMapData2x<T>, options?: Encode2xOptions): string {
  if (value.prefix.length === 0) throw new File2xSyntaxError("Map prefix cannot be empty");
  value.prefix.forEach((part) => assertIdentifier(part, "map prefix"));
  assertIdentifier(value.mapId, "map id");
  return `${[...value.prefix, value.mapId].join(".")} =\n${JSON.stringify(value.data, null, indent(options))}`;
}

export function decodeGameMapData2x<T = PlainData>(source: string): GameMapData2x<T> {
  const statements = significantStatements(parseProgram(source));
  if (statements.length !== 1 || statements[0].type !== "ExpressionStatement") {
    throw new File2xSyntaxError("Expected exactly one map assignment");
  }
  const expression = statements[0].expression as AstNode | undefined;
  if (expression?.type !== "AssignmentExpression" || expression.operator !== "=") {
    throw new File2xSyntaxError("Expected a map assignment expression");
  }
  const left = expression.left as AstNode;
  const right = expression.right as AstNode;
  const path = readMemberPath(left);
  if (path.length < 2) throw new File2xSyntaxError("Map assignment requires a prefix and map id");
  return {
    prefix: path.slice(0, -1),
    mapId: path.at(-1)!,
    data: parseData<T>(source, right),
  };
}
