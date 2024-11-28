import { CompilerOptions, parseConfigFileTextToJson, transpile } from "typescript";

export const parseTSConfig = (input: string) => {
  return parseConfigFileTextToJson("tsconfig.json", input);
};

export const transpileTS = (filename: string, input: string, options?: CompilerOptions) => {
  return transpile(input, options, filename);
};
