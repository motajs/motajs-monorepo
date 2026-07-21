import {
  MonacoLanguageLibraryScope,
  setMonacoTheme,
  type MonacoExtraLibrary,
} from "@motajs/react-monaco-editor";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { projectData } from "@/project/data/projectData";
import type { RuntimeLanguageSnapshot, RuntimeMemberSnapshot } from "@/runtime/protocol";
import { useRuntimePreview, type RuntimePreviewCapability } from "@/runtime/RuntimeContext";
import { EditorStore } from "@/stores/EditorStore";
import { useEffect, useState } from "react";
import { buildTernDeclaration } from "./ternDeclaration";

export interface ProjectLanguageStatus {
  state: "idle" | "loading" | "ready" | "degraded";
  message?: string;
}

function memberType(member: RuntimeMemberSnapshot): string {
  if (member.kind === "function") return "(...args: any[]) => any";
  if (member.kind === "array") return "any[]";
  // Reflection only proves that this is an object; it cannot describe the
  // value shape. `unknown` here created false errors for coordinates and other
  // dynamic engine records, while the known member names are still preserved
  // by the generated object intersection.
  if (member.kind === "object") return "Record<string, any>";
  if (["string", "number", "boolean"].includes(member.kind)) return member.kind;
  return "unknown";
}

interface SnapshotTypeNode {
  member?: RuntimeMemberSnapshot;
  children: Map<string, SnapshotTypeNode>;
}

function addSnapshotPath(root: SnapshotTypeNode, path: readonly string[], members: readonly RuntimeMemberSnapshot[]): void {
  let current = root;
  for (const segment of path) {
    let child = current.children.get(segment);
    if (!child) {
      child = { children: new Map() };
      current.children.set(segment, child);
    }
    current = child;
  }
  for (const member of members) {
    const child: SnapshotTypeNode = current.children.get(member.name) ?? { children: new Map() };
    child.member = member;
    current.children.set(member.name, child);
  }
}

function snapshotNodeType(node: SnapshotTypeNode, indent: string): string {
  const own = node.member ? memberType(node.member) : undefined;
  if (node.children.size === 0) return own ?? "unknown";
  const nextIndent = `${indent}  `;
  const shape = `{\n${[...node.children].map(([name, child]) => (
    `${nextIndent}${JSON.stringify(name)}: ${snapshotNodeType(child, nextIndent)};`
  )).join("\n")}\n${indent}}`;
  return own && own !== "unknown" ? `${own} & ${shape}` : shape;
}

export function buildRuntimeSnapshotDeclaration(snapshot: RuntimeLanguageSnapshot): string {
  const root: SnapshotTypeNode = { children: new Map() };
  addSnapshotPath(root, [], snapshot.core);
  for (const [name, members] of Object.entries(snapshot.modules)) addSnapshotPath(root, [name], members);
  for (const [path, members] of Object.entries(snapshot.catalogs)) addSnapshotPath(root, path.split("."), members);
  const specials = snapshot.specials.length > 0
    ? snapshot.specials.map((special) => special.id).join(" | ")
    : "number";
  const specialDocs = snapshot.specials.map((special) => ` * ${special.id}: ${special.name.replace(/\*\//g, "* /")}`).join("\n");
  return `
type MotaEnemySpecialId = ${specials};
/** 当前工程运行时探测到的怪物特殊属性：
${specialDocs}
 */
interface MotaProjectRuntimeSnapshot {
${[...root.children].map(([name, node]) => `  ${JSON.stringify(name)}: ${snapshotNodeType(node, "  ")};`).join("\n")}
}
`;
}

function projectCatalogDeclaration(): string {
  const readKeys = (resource: ReturnType<typeof projectData.items>): string[] => {
    const content = resource.snapshot();
    return content.status === "loaded" ? Object.keys(content.value) : [];
  };
  const union = (values: readonly string[]) => values.length > 0
    ? values.map((value) => JSON.stringify(value)).join(" | ")
    : "string";
  const tower = projectData.tower().snapshot();
  const main = tower.status === "loaded" ? tower.value.main : undefined;
  return `
type MotaItemId = ${union(readKeys(projectData.items()))};
type MotaEnemyId = ${union(readKeys(projectData.enemys()))};
type MotaFloorId = ${union(main?.floorIds ?? [])};
type MotaBgmId = ${union(Array.isArray(main?.bgms) ? main.bgms : [])};
type MotaSoundId = ${union(Array.isArray(main?.sounds) ? main.sounds : [])};
`;
}

export function composeCoreDeclaration(runtimeSource: string, augmentations: readonly string[]): string {
  const intersection = augmentations.join(" & ");
  if (!runtimeSource) return `declare let core: ${intersection || "any"};\n`;
  let source = runtimeSource;
  const coreDeclaration = /declare\s+let\s+core\s*:\s*core\b/;
  if (intersection && coreDeclaration.test(source)) {
    source = source.replace(coreDeclaration, `declare let core: core & ${intersection}`);
  } else if (intersection) {
    source = `${source}\ndeclare let core: ${intersection};\n`;
  }
  const mainDeclaration = /declare\s+let\s+main\s*:\s*main\b/;
  if (mainDeclaration.test(source)) {
    source = source.replace(mainDeclaration, "declare let main: main & MotaMainRuntimeCompatibility");
  }
  return source;
}

export function buildRuntimeCompatibilityDeclaration(): string {
  return `
interface MotaRuntimeCompatibility {
  animateFrame: Record<string, any> & {
    weather: Record<string, any> & { level?: number };
  };
  initStatus: {
    globalAttribute: Record<string, any> & {
      selectColor: string | number[];
    };
  };
  status: {
    globalAttribute: Record<string, any> & {
      selectColor: string | number[];
    };
  };
  material: {
    /** Hot-reload plugins replace the runtime registry after loading a file. */
    icons: Record<string, any>;
  };
}

interface MotaMainRuntimeCompatibility {
  replayChecking?: boolean;
  floors: Record<string, any>;
}

interface Window {
  core: typeof core;
  hero: typeof hero;
  flags: typeof flags;
  /** Projects may replace the built-in Sprite implementation. */
  Sprite: any;
}

interface HTMLOptionElement {
  /** Legacy editor plugins attach project metadata directly to options. */
  name: string;
}

/** JavaScript coerces numeric input here; TypeScript's library only declares strings. */
declare function parseInt(value: number, radix?: number): number;

/** Globals provided by the game/editor bootstrap and used by hot-reload plugins. */
declare const editor: any;
declare let functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a: Record<string, any>;
declare let plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1: Record<string, any>;
declare let data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d: Record<string, any>;
declare let enemys_fcae963b_31c9_42b4_b48c_bb48d09f3f80: Record<string, any>;
declare let icons_4665ee12_3a1f_44a4_bea3_0fccba634dc1: Record<string, any>;
declare let items_296f5d02_12fd_4166_a7c1_b5e830c9ee3a: Record<string, any>;
declare let maps_90f36752_8815_4be8_b32b_d7fad1d0542e: Record<string, any>;
declare let events_c12a15a8_c380_4b28_8144_256cba95f760: Record<string, any>;

`;
}

export class ProjectLanguageEnvironment {
  private readonly libraries = new MonacoLanguageLibraryScope("mota-project");
  private generation = 0;
  private status: ProjectLanguageStatus = { state: "idle" };
  private readonly listeners = new Set<(status: ProjectLanguageStatus) => void>();

  subscribe(listener: (status: ProjectLanguageStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private update(status: ProjectLanguageStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  async refresh(runtime: RuntimePreviewCapability): Promise<void> {
    const generation = ++this.generation;
    // Keep the last usable language environment while optional declarations
    // refresh. Only the very first load needs a blocking loading state.
    if (this.status.state === "idle") this.update({ state: "loading" });
    let runtimeSource = "";
    let ternDeclaration = "";
    const degraded: string[] = [];
    try {
      const handler = await FileHandlerManager.load("runtime.d.ts");
      const content = handler.getContent();
      if (content.status !== "loaded") throw new Error("工程根目录缺少 runtime.d.ts");
      runtimeSource = content.value;
    } catch (error) {
      console.warn(
        "runtime.d.ts is unavailable; continuing with Tern and runtime declarations",
        error,
      );
    }

    try {
      const handler = await FileHandlerManager.load("_server/CodeMirror/defs.js");
      const content = handler.getContent();
      if (content.status !== "loaded") throw new Error("_server/CodeMirror/defs.js 不存在");
      const converted = buildTernDeclaration(content.value);
      ternDeclaration = converted.declaration;
      degraded.push(...converted.diagnostics.map((message) => `Tern 定义：${message}`));
    } catch (error) {
      degraded.push(`Tern 定义不可用：${error instanceof Error ? error.message : String(error)}`);
    }

    if (generation !== this.generation) return;

    const apply = (snapshot?: RuntimeLanguageSnapshot, snapshotError?: string) => {
      if (generation !== this.generation) return;
      const libraries: MonacoExtraLibrary[] = [];
      const coreAugmentations = [
        "MotaRuntimeCompatibility",
        ternDeclaration ? "__MotaTernCore" : undefined,
        snapshot ? "MotaProjectRuntimeSnapshot" : undefined,
      ].filter((value): value is string => Boolean(value));
      const base = composeCoreDeclaration(runtimeSource, coreAugmentations);
      if (ternDeclaration) {
        libraries.push({ path: "inmemory://motajs/tern-compatibility.d.ts", content: ternDeclaration });
      }
      if (snapshot) {
        libraries.push({
          path: "inmemory://motajs/project-runtime-snapshot.d.ts",
          content: buildRuntimeSnapshotDeclaration(snapshot),
        });
      }
      libraries.push(
        { path: "inmemory://motajs/runtime.d.ts", content: base },
        { path: "inmemory://motajs/runtime-compatibility.d.ts", content: buildRuntimeCompatibilityDeclaration() },
        { path: "inmemory://motajs/project-catalog.d.ts", content: projectCatalogDeclaration() },
      );
      this.libraries.replace(libraries);
      const diagnostics = snapshotError
        ? [...degraded, `动态探测不可用：${snapshotError}`]
        : degraded;
      this.update(diagnostics.length > 0
        ? { state: "degraded", message: `已加载可用类型；${diagnostics.join("；")}` }
        : { state: "ready" });
    };

    // Runtime reflection is optional. Do not hold the usable static/Tern
    // environment in a loading state while the iframe request is pending.
    apply(undefined, runtime.state.status === "ready" ? undefined : "运行时尚未就绪");
    if (runtime.state.status !== "ready") return;
    try {
      apply(await runtime.languageSnapshot());
    } catch (error) {
      apply(undefined, error instanceof Error ? error.message : String(error));
    }
  }

  dispose(): void {
    this.generation += 1;
    this.libraries.dispose();
    this.update({ state: "idle" });
  }
}

const environment = new ProjectLanguageEnvironment();

export function useProjectLanguageEnvironment(): ProjectLanguageStatus {
  const runtime = useRuntimePreview();
  const { theme } = EditorStore.useStore();
  const [status, setStatus] = useState<ProjectLanguageStatus>({ state: "idle" });

  useEffect(() => environment.subscribe(setStatus), []);
  useEffect(() => {
    setMonacoTheme(theme === "editor_color_dark" ? "dark" : "light");
  }, [theme]);
  useEffect(() => {
    void environment.refresh(runtime);
  }, [runtime, runtime.state.instanceId, runtime.state.status]);
  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void environment.refresh(runtime), 250);
    };
    const unsubscribers = [
      projectData.tower().subscribe(refresh),
      projectData.items().subscribe(refresh),
      projectData.enemys().subscribe(refresh),
      projectData.functions().subscribe(refresh),
      projectData.plugins().subscribe(refresh),
    ];
    return () => {
      window.clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [runtime]);
  return status;
}

export function disposeProjectLanguageEnvironment(): void {
  environment.dispose();
}
