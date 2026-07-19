import * as Infer from "tern/lib/infer";
import * as Tern from "tern";

export const SEMANTIC_TYPES_QUERY = "semanticTypes" as const;

export interface SemanticTypesQuery extends Tern.BaseQueryWithFile {
  type: typeof SEMANTIC_TYPES_QUERY;
  positions: Tern.Position[];
  /** CodeMirror's request builder consumes this flag before sending the query. */
  fullDocs?: boolean;
  end: Tern.Position;
}

export interface SemanticTypesQueryResult {
  types: Array<string | null>;
}

declare module "tern" {
  interface QueryRegistry {
    semanticTypes: {
      query: SemanticTypesQuery;
      result: SemanticTypesQueryResult;
    };
  }
}

type QueryExpression = Parameters<typeof Infer.expressionType>[0];

type TernQueryApi = typeof Tern & {
  findQueryExpr(
    file: Tern.File,
    query: Tern.BaseQueryWithFile & { end: number | Tern.Position },
    wide?: boolean,
  ): QueryExpression | null;
};

type InferStringApi = typeof Infer & {
  toString(type: Infer.AVal | Infer.Type, depth?: number): string;
};

let registered = false;

/**
 * Tern's protocol accepts one query per request. This custom query resolves all
 * visible identifiers after a single analysis pass and returns aligned types.
 */
export function registerSemanticTypesQuery(): void {
  if (registered) return;
  registered = true;

  Tern.defineQueryType(SEMANTIC_TYPES_QUERY, {
    takesFile: true,
    run(_server, query, file) {
      if (!file) return { types: query.positions.map(() => null) };
      const ternApi = Tern as TernQueryApi;
      const inferApi = Infer as InferStringApi;
      const types = query.positions.map((position) => {
        try {
          const expression = ternApi.findQueryExpr(file, {
            ...query,
            end: position,
          });
          if (!expression) return null;
          Infer.resetGuessing();
          return inferApi.toString(Infer.expressionType(expression), 3);
        } catch {
          return null;
        }
      });
      return { types };
    },
  });
}
