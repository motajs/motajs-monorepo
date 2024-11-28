import path from "path";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../../");

/**
 *
 * @param {string} type
 * @returns
 */
const getAliasByPackageType = (type) => {
  switch (type) {
    case "libs": return "lib";
    case "apps":
    case "external":
      return "src";
    default:
      throw new Error(`unexcepted package type ${type}`);
  }
};

/**
 * @type {import("vite").Plugin}
 */
export const resolvePlugin = {
  name: "resolve",
  resolveId(source, importer, options) {
    if (!source.startsWith("@/") || !importer) return null;
    const [packages, type, name] = path.relative(WORKSPACE_ROOT, importer).split(path.sep);
    const alias = getAliasByPackageType(type);
    const rest = source.substring(2);
    const result = path.join(WORKSPACE_ROOT, packages, type, name, alias, rest);
    return this.resolve(result, importer, options);
  },
};
