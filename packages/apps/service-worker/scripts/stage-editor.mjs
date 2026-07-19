import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const safePath = (value) => Boolean(
  value
    && !value.includes("\0")
    && !value.includes("\\")
    && !path.posix.isAbsolute(value)
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
);

async function walk(root, relative = "") {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (entry.isSymbolicLink()) throw new Error(`Editor artifact cannot contain symlinks: ${entry.name}`);
    const name = path.posix.join(relative, entry.name);
    if (!safePath(name)) throw new Error(`Unsafe Editor artifact path: ${name}`);
    return entry.isDirectory() ? await walk(root, name) : [name];
  }));
  return nested.flat().sort();
}

const hash = (content) => createHash("sha256").update(content).digest("hex");

async function buildId(root, names) {
  const digest = createHash("sha256");
  for (const name of names.filter((item) => item !== "editor-manifest.json").sort()) {
    digest.update(name).update("\0").update(await fs.readFile(path.join(root, name))).update("\0");
  }
  return digest.digest("hex");
}

export async function validateEditorArtifact(input) {
  const root = await fs.realpath(path.resolve(input));
  const names = await walk(root);
  if (!names.includes("editor-manifest.json")) throw new Error("Editor artifact is missing editor-manifest.json");
  const manifest = JSON.parse(await fs.readFile(path.join(root, "editor-manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 2) throw new Error("Unsupported Editor artifact schemaVersion");
  if (manifest.environmentProtocolVersion !== 1) throw new Error("Unsupported Editor environment protocol");
  if (!/^[a-f0-9]{64}$/.test(manifest.buildId ?? "")) throw new Error("Editor artifact buildId is invalid");
  if (manifest.entrypoints?.editor !== "index.html" || manifest.entrypoints?.runtime !== "runtime.html") {
    throw new Error("Editor artifact entrypoints are incompatible");
  }
  if (!Array.isArray(manifest.files)) throw new Error("Editor artifact file list is missing");
  const expected = names.filter((name) => name !== "editor-manifest.json");
  const listed = manifest.files.map((file) => file.path);
  if (new Set(listed).size !== listed.length || JSON.stringify([...listed].sort()) !== JSON.stringify(expected)) {
    throw new Error("Editor artifact file list does not match its contents");
  }
  for (const file of manifest.files) {
    if (!safePath(file.path)) throw new Error(`Unsafe Editor artifact path: ${file.path}`);
    const content = await fs.readFile(path.join(root, file.path));
    if (content.byteLength !== file.size) throw new Error(`Editor artifact size mismatch: ${file.path}`);
    if (hash(content) !== file.sha256) throw new Error(`Editor artifact hash mismatch: ${file.path}`);
  }
  if (manifest.buildId !== await buildId(root, names)) throw new Error("Editor artifact buildId does not match its contents");
  return { root, manifest };
}

export async function stageEditorArtifact(input, output = path.resolve(import.meta.dirname, "../dist/static/editor")) {
  const { root, manifest } = await validateEditorArtifact(input);
  const releases = path.join(output, "releases");
  const destination = path.join(releases, manifest.buildId);
  await fs.mkdir(releases, { recursive: true });
  try {
    await fs.access(destination);
  } catch {
    const temporary = path.join(releases, `.${manifest.buildId}.tmp-${process.pid}`);
    await fs.rm(temporary, { recursive: true, force: true });
    await fs.cp(root, temporary, { recursive: true, errorOnExist: true, force: false });
    await fs.rename(temporary, destination);
  }
  let previousPointer;
  try {
    previousPointer = JSON.parse(await fs.readFile(path.join(output, "current.json"), "utf8"));
  } catch {
    previousPointer = undefined;
  }
  const previousBuildId = previousPointer?.buildId === manifest.buildId
    ? previousPointer?.previousBuildId
    : previousPointer?.buildId;
  const channel = {
    schemaVersion: 1,
    buildId: manifest.buildId,
    ...(/^[a-f0-9]{64}$/.test(previousBuildId ?? "") ? { previousBuildId } : {}),
  };
  const pointer = `${JSON.stringify(channel, null, 2)}\n`;
  const temporaryPointer = path.join(output, `.current.tmp-${process.pid}`);
  await fs.writeFile(temporaryPointer, pointer);
  await fs.rename(temporaryPointer, path.join(output, "current.json"));
  await pruneEditorReleases(output, channel);
  return { buildId: manifest.buildId, destination };
}

export async function pruneEditorReleases(output, channel, now = Date.now(), maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const releases = path.join(output, "releases");
  const retained = new Set([channel.buildId, channel.previousBuildId].filter(Boolean));
  let entries;
  try {
    entries = await fs.readdir(releases, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory() || retained.has(entry.name) || !/^[a-f0-9]{64}$/.test(entry.name)) return;
    const info = await fs.stat(path.join(releases, entry.name));
    if (now - info.mtimeMs < maxAgeMs) return;
    await fs.rm(path.join(releases, entry.name), { recursive: true, force: true });
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const artifact = process.env.MOTA_EDITOR_ARTIFACT
    ?? path.resolve(import.meta.dirname, "../../editor/dist");
  const output = process.env.MOTA_EDITOR_OUTPUT;
  const result = await stageEditorArtifact(artifact, output ? path.resolve(output) : undefined);
  console.log(`Staged Editor ${result.buildId} at ${result.destination}`);
}
