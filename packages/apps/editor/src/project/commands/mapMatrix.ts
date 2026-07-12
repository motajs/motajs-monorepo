export type MapMatrix = number[][];

export interface ParseMapMatrixOptions {
  width?: number;
  height?: number;
}

function stripTrailingCommas(value: string): string {
  return value.trim().replace(/,\s*$/g, "").replace(/,\s*([\]}])/g, "$1");
}

function parseCandidate(value: string): unknown {
  return JSON.parse(stripTrailingCommas(value));
}

function normalizeParsedMatrix(value: unknown): MapMatrix {
  if (!Array.isArray(value)) {
    throw new Error("Map data must be an array");
  }

  return value.map((row, y) => {
    if (!Array.isArray(row)) {
      throw new Error(`Map row ${y} must be an array`);
    }
    return row.map((cell, x) => {
      const num = typeof cell === "number" ? cell : Number(cell);
      if (!Number.isInteger(num) || num < 0) {
        throw new Error(`Invalid map idnum at ${x},${y}: ${String(cell)}`);
      }
      return num;
    });
  });
}

export function assertMapMatrixSize(
  matrix: MapMatrix,
  options: ParseMapMatrixOptions,
): void {
  if (options.height != null && matrix.length !== options.height) {
    throw new Error(`Map height mismatch: expected ${options.height}, got ${matrix.length}`);
  }

  const width = options.width ?? matrix[0]?.length ?? 0;
  for (let y = 0; y < matrix.length; y += 1) {
    if (matrix[y].length !== width) {
      throw new Error(`Map row ${y} width mismatch: expected ${width}, got ${matrix[y].length}`);
    }
  }

  if (options.width != null && width !== options.width) {
    throw new Error(`Map width mismatch: expected ${options.width}, got ${width}`);
  }
}

export function parseMapMatrixText(
  text: string,
  options: ParseMapMatrixOptions = {},
): MapMatrix {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Map data is empty");

  let parsed: unknown;
  try {
    parsed = parseCandidate(trimmed);
  } catch {
    parsed = parseCandidate(`[${trimmed}]`);
  }

  const matrix = normalizeParsedMatrix(parsed);
  assertMapMatrixSize(matrix, options);
  return matrix;
}

export function formatMapMatrixText(matrix: MapMatrix): string {
  assertMapMatrixSize(matrix, {});
  return matrix
    .map((row) =>
      `[${row
        .map((cell) => {
          const value = String(cell);
          return `${" ".repeat(Math.max(4 - value.length, 0))}${value}`;
        })
        .join(",")}]`
    )
    .join(",\n");
}
