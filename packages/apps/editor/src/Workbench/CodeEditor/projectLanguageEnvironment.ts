import {
  MonacoLanguageLibraryScope,
  setMonacoTheme,
  type MonacoExtraLibrary,
} from "@motajs/react-monaco-editor";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { projectData } from "@/project/data/projectData";
import { projectModel } from "@/project/model/projectModel";
import { useRuntimePreview, type RuntimePreviewCapability } from "@/runtime/RuntimeContext";
import { EditorStore } from "@/stores/EditorStore";
import { useEffect, useState } from "react";
import { buildTernDeclaration } from "./ternDeclaration";

export interface ProjectLanguageStatus {
  state: "idle" | "loading" | "ready" | "degraded";
  message?: string;
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
    if (this.status.state === "idle") this.update({ state: "loading" });
    let defsSource: string;
    let baseDeclaration: ReturnType<typeof buildTernDeclaration>;
    try {
      const handler = await FileHandlerManager.load("_server/CodeMirror/defs.js");
      const content = handler.getContent();
      if (content.status !== "loaded") throw new Error("_server/CodeMirror/defs.js 不存在");
      defsSource = content.value;
      // Parse before replacing the current environment. A broken defs file is
      // a fallback condition, not a reason to discard the last usable libs.
      baseDeclaration = buildTernDeclaration(defsSource);
    } catch (error) {
      const defsError = error instanceof Error ? error.message : String(error);
      console.warn("defs.js is unavailable; falling back to runtime.d.ts", error);
      let fallback = "";
      try {
        const handler = await FileHandlerManager.load("runtime.d.ts");
        const content = handler.getContent();
        if (content.status !== "loaded") throw new Error("工程根目录缺少 runtime.d.ts");
        fallback = composeCoreDeclaration(content.value, ["MotaRuntimeCompatibility"]);
      } catch (fallbackError) {
        console.warn("runtime.d.ts fallback is unavailable; using loose declarations", fallbackError);
        fallback = `
type MotaLooseRuntimeObject = Record<string, any>;
declare let core: MotaLooseRuntimeObject;
declare let hero: MotaLooseRuntimeObject;
declare let flags: MotaLooseRuntimeObject;
`;
      }
      if (generation !== this.generation) return;
      this.libraries.replace([
        { path: "inmemory://motajs/runtime-fallback.d.ts", content: fallback },
        { path: "inmemory://motajs/runtime-compatibility.d.ts", content: buildRuntimeCompatibilityDeclaration() },
        { path: "inmemory://motajs/project-catalog.d.ts", content: projectCatalogDeclaration() },
      ]);
      this.update({ state: "degraded", message: `defs.js 不可用：${defsError}` });
      return;
    }

    if (generation !== this.generation) return;
    const applyDeclaration = (converted: ReturnType<typeof buildTernDeclaration>) => {
      if (generation !== this.generation) return;
      const libraries: MonacoExtraLibrary[] = [
        { path: "inmemory://motajs/tern-compatibility.d.ts", content: converted.declaration },
        { path: "inmemory://motajs/runtime-compatibility.d.ts", content: buildRuntimeCompatibilityDeclaration() },
        { path: "inmemory://motajs/project-catalog.d.ts", content: projectCatalogDeclaration() },
      ];
      this.libraries.replace(libraries);
      this.update(converted.diagnostics.length > 0
        ? { state: "degraded", message: converted.diagnostics.join("；") }
        : { state: "ready" });
    };

    // defs.js is the primary source and becomes usable immediately. Runtime
    // reflection and the project-wide flag scan only replace it with a richer
    // generation when they settle.
    applyDeclaration(baseDeclaration);
    const flagResource = projectModel.flagUsage();
    const flagsPromise = flagResource.ensureLoaded().then(() => {
      const content = flagResource.snapshot();
      return content.status === "loaded" ? content.value.flags : [];
    }).catch((error) => {
      console.warn("Project flag usage is unavailable; keeping defs.js flags", error);
      return [] as string[];
    });
    const snapshotPromise = runtime.state.status === "ready"
      ? runtime.languageSnapshot().catch((error) => {
          console.warn("Runtime language snapshot is unavailable; keeping static defs.js declarations", error);
          return undefined;
        })
      : Promise.resolve(undefined);
    const [projectFlags, snapshot] = await Promise.all([flagsPromise, snapshotPromise]);
    if (generation !== this.generation) return;
    applyDeclaration(buildTernDeclaration(defsSource, {
      ...(snapshot ?? {}),
      projectFlags,
    }));
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
      projectModel.flagUsage().subscribe(refresh),
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
