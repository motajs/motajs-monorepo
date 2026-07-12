import { parse } from "acorn";

export class File2xSyntaxError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "File2xSyntaxError";
  }
}

export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

interface ProgramNode extends AstNode {
  body: AstNode[];
}

export function parseProgram(source: string): ProgramNode {
  try {
    return parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowHashBang: true,
    }) as unknown as ProgramNode;
  } catch (error) {
    throw new File2xSyntaxError(
      `Invalid JavaScript wrapper: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function significantStatements(program: ProgramNode): AstNode[] {
  return program.body.filter((statement) => statement.type !== "EmptyStatement");
}

export function readVariableAssignment(source: string): { uuid: string; value: AstNode } {
  const statements = significantStatements(parseProgram(source));
  if (statements.length !== 1 || statements[0].type !== "VariableDeclaration") {
    throw new File2xSyntaxError("Expected exactly one variable declaration");
  }

  const declarations = statements[0].declarations;
  if (!Array.isArray(declarations) || declarations.length !== 1) {
    throw new File2xSyntaxError("Expected exactly one variable declarator");
  }
  const declaration = declarations[0] as AstNode;
  const id = declaration.id as AstNode | undefined;
  const value = declaration.init as AstNode | undefined;
  if (id?.type !== "Identifier" || typeof id.name !== "string" || !value) {
    throw new File2xSyntaxError("Expected an initialized identifier declaration");
  }
  return { uuid: id.name, value };
}

export function readMemberPath(node: AstNode): string[] {
  if (node.type === "Identifier" && typeof node.name === "string") return [node.name];
  if (node.type !== "MemberExpression") {
    throw new File2xSyntaxError("Expected an identifier member path");
  }

  const object = node.object as AstNode | undefined;
  const property = node.property as AstNode | undefined;
  if (!object || !property) throw new File2xSyntaxError("Incomplete member expression");

  let name: string | undefined;
  if (node.computed === true) {
    if (property.type === "Literal" && (typeof property.value === "string" || typeof property.value === "number")) {
      name = String(property.value);
    }
  } else if (property.type === "Identifier" && typeof property.name === "string") {
    name = property.name;
  }
  if (name === undefined) throw new File2xSyntaxError("Unsupported computed member name");
  return [...readMemberPath(object), name];
}

export function assertIdentifier(value: string, description: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    throw new File2xSyntaxError(`Invalid ${description}: ${value}`);
  }
}
