import { CompilerOptions, transpile } from "typescript";

export const transpileTS = (input: string, options: CompilerOptions) => {
  return transpile(input, options);
};
