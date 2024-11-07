import path from "path";
import { Plugin } from "vite";

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../");

const getAliasByPackageType = (type: string) => {
  switch (type) {
    case "libs": return "lib";
    case "apps":
    case "external":
      return "src";
    default:
      throw new Error(`unexcepted package type ${type}`);
  }
};

export const resolvePlugin: Plugin = {
  name: "resolve",
  resolveId(source, importer, options) {
    if (!source.startsWith("@/") || !importer) return null;
    console.log(source, importer, options);
    const [packages, type, name] = path.relative(WORKSPACE_ROOT, importer).split(path.sep);
    const alias = getAliasByPackageType(type);
    const rest = source.substring(2);
    const result = path.join(WORKSPACE_ROOT, packages, type, name, alias, rest);
    return this.resolve(result, importer, options);
  },
};
