import { once } from "lodash-es";
import {
  createScanner, createSourceFile,
  isFunctionExpression, isIdentifier, isPropertyAssignment, isObjectLiteralExpression, isVariableStatement,
  Expression, Scanner, ScriptTarget, SyntaxKind,
} from "typescript";

const getScanner = once(() => createScanner(ScriptTarget.ESNext, true));

class IllegalDataError extends Error {

}

const createScanWithExcept = (scanner: Scanner) => {
  const scanWithExcept = (judge: (token: SyntaxKind) => boolean, description: string) => {
    const token = scanner.scan();
    if (!judge(token)) {
      throw new IllegalDataError(`except ${description}, read ${scanner.getTokenText()}`);
    }
    return token;
  };
  return scanWithExcept;
};

type PlainData = number | string | boolean | PlainData[] | {
  [key: string]: PlainData;
};

export interface GameData2x<T = PlainData> {
  uuid: string;
  data: T;
}

export const encodeGameData2x = <T>(data: GameData2x<T>): string => {
  const dataJSON = JSON.stringify(data.data, null, 4);
  return `var ${data.uuid} =\n${dataJSON}`;
};

export const decodeGameData2x = <T = PlainData>(rawData: string): GameData2x<T> => {
  const scanner = getScanner();
  scanner.setText(rawData);
  const scanWithExcept = createScanWithExcept(scanner);
  scanWithExcept((token) => [SyntaxKind.VarKeyword, SyntaxKind.LetKeyword, SyntaxKind.ConstKeyword].includes(token), "keyword");
  scanWithExcept((token) => token === SyntaxKind.Identifier, "identifier");
  const uuid = scanner.getTokenText();
  scanWithExcept((token) => token === SyntaxKind.EqualsToken, "\"=\"");
  const equalEnd = scanner.getTokenEnd();
  const data = rawData.slice(equalEnd);
  return {
    uuid,
    data: JSON.parse(data),
  };
};

export interface GameMapData2x<T = PlainData> {
  prefix: string[];
  mapId: string;
  data: T;
}

export const encodeGameMapData2x = <T>(data: GameMapData2x<T>): string => {
  const dataJSON = JSON.stringify(data.data, null, 4);
  return `${data.prefix.join(".")}.${data.mapId} =\n${dataJSON}`;
};

export const decodeGameMapData2x = <T = PlainData>(rawData: string): GameMapData2x<T> => {
  const scanner = getScanner();
  scanner.setText(rawData);
  const scanWithExcept = createScanWithExcept(scanner);
  const spans: string[] = [];
  do {
    scanWithExcept((token) => token === SyntaxKind.Identifier, "identifier");
    const span = scanner.getTokenText();
    spans.push(span);
    const token = scanner.scan();
    if (token === SyntaxKind.EqualsToken) {
      break;
    }
    if (token === SyntaxKind.DotToken) {
      continue;
    }
    throw new IllegalDataError(`except ".", read ${scanner.getTokenText()}`);
  } while (false);
  const [mapId, ...prefix] = spans.toReversed();
  const equalEnd = scanner.getTokenEnd();
  const data = rawData.slice(equalEnd);
  return {
    prefix,
    mapId,
    data: JSON.parse(data),
  };
};

type ScriptData = string | {
  [key: string]: ScriptData;
};

export interface GameScript2x {
  uuid: string;
  data: ScriptData;
}

export const encodeGameScript2x = (data: GameScript2x): string => {
  const INDENT = "\t";
  const serializeRecursively = (data: ScriptData, indent: string): string => {
    const nextIndent = indent + INDENT;
    const lines = Object.entries(data).map(([k, v]) => {
      const value = typeof v === "string" ? v : serializeRecursively(v, nextIndent);
      return `${nextIndent}"${k}": ${value}`;
    });
    return [`{`, lines.join(",\n"), `${indent}}`].join("\n");
  };
  const dataJSON = serializeRecursively(data.data, "");
  return `var ${data.uuid} =\n${dataJSON}`;
};

export const decodeGameScript2x = (rawData: string): GameScript2x => {
  const sf = createSourceFile("script.ts", rawData, ScriptTarget.ESNext);
  const [statement] = sf.statements;
  if (!isVariableStatement(statement)) {
    throw new IllegalDataError(`except VariableStatement, read ${SyntaxKind[statement.kind]}`);
  }
  const [declaration] = statement.declarationList.declarations;
  if (!isIdentifier(declaration.name)) {
    throw new IllegalDataError(`except Identifier, read ${declaration.getText(sf)}`);
  }
  const uuid = declaration.name.text;

  if (!declaration.initializer) {
    throw new IllegalDataError(`except VariableStatement has initializer`);
  }

  const unserializeRecursively = (expression: Expression): ScriptData => {
    if (isFunctionExpression(expression)) {
      return expression.getText(sf);
    }
    if (isObjectLiteralExpression(expression)) {
      return Object.fromEntries(expression.properties.map((property) => {
        if (!isPropertyAssignment(property)) {
          throw new IllegalDataError(`except PropertyAssignment, read ${SyntaxKind[property.kind]}`);
        }
        return [property.name, unserializeRecursively(property.initializer)];
      }));
    }
    throw new IllegalDataError(`except function or object, read ${SyntaxKind[expression.kind]}`);
  };
  const data = unserializeRecursively(declaration.initializer);

  return {
    uuid,
    data,
  };
};
