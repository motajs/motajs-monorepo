import { computed, effect } from "alien-signals";
import type { ReadonlySignal } from "@/fs/interfaces";
import type { Content } from "@/fs/types";
import type { PersistStatus } from "@/project/data/DataResource";
import type { ImageAssetResource } from "./ImageAssetResource";

export interface AnimationSoundCue {
  frame: number;
  sound: string;
  pitch: number;
}

export interface AnimationDocument extends Record<string, unknown> {
  ratio?: number;
  bitmaps?: string[];
  frame_max?: number;
  frames?: unknown[][];
  se?: string | Record<string, string>;
  pitch?: number | Record<string, number>;
}

export interface AnimationAssetSnapshot {
  document: AnimationDocument;
  cues: AnimationSoundCue[];
  revision: number;
}

function normalizePitch(value: unknown): number {
  const pitch = Number(value);
  return Number.isFinite(pitch) ? Math.max(30, Math.min(300, pitch)) : 100;
}

export function animationSoundCues(document: AnimationDocument): AnimationSoundCue[] {
  if (typeof document.se === "string") {
    return document.se ? [{ frame: 1, sound: document.se, pitch: normalizePitch(document.pitch) }] : [];
  }
  if (!document.se || typeof document.se !== "object") return [];
  const pitch = document.pitch && typeof document.pitch === "object" ? document.pitch : {};
  return Object.entries(document.se)
    .flatMap(([frame, sound]) => {
      const frameNumber = Number(frame);
      return Number.isInteger(frameNumber) && frameNumber > 0 && typeof sound === "string" && sound
        ? [{ frame: frameNumber, sound, pitch: normalizePitch((pitch as Record<string, number>)[frame]) }]
        : [];
    })
    .sort((left, right) => left.frame - right.frame);
}

export function withAnimationSoundCues(
  document: AnimationDocument,
  cues: AnimationSoundCue[],
): AnimationDocument {
  const normalized = [...cues]
    .map((cue) => ({ frame: cue.frame, sound: cue.sound, pitch: normalizePitch(cue.pitch) }))
    .sort((left, right) => left.frame - right.frame);
  const next = { ...document };
  if (normalized.length === 0) {
    delete next.se;
    delete next.pitch;
  } else if (normalized.length === 1 && normalized[0].frame === 1 && normalized[0].pitch === 100) {
    next.se = normalized[0].sound;
    delete next.pitch;
  } else {
    next.se = Object.fromEntries(normalized.map((cue) => [String(cue.frame), cue.sound]));
    const pitches = normalized.filter((cue) => cue.pitch !== 100);
    if (pitches.length) next.pitch = Object.fromEntries(pitches.map((cue) => [String(cue.frame), cue.pitch]));
    else delete next.pitch;
  }
  return next;
}

export class AnimationAssetResource {
  readonly id: string;
  readonly path: string;
  readonly content: ReadonlySignal<Content<AnimationAssetSnapshot>>;
  private readonly binary: ImageAssetResource;

  constructor(path: string, binary: ImageAssetResource) {
    this.path = path;
    this.id = `animation:${path}`;
    this.binary = binary;
    this.content = computed(() => {
      const content = binary.content();
      if (content.status !== "loaded") return content as Content<AnimationAssetSnapshot>;
      try {
        const document = JSON.parse(new TextDecoder().decode(content.value.bytes)) as AnimationDocument;
        if (!document || typeof document !== "object" || Array.isArray(document)) {
          throw new Error("Animation document must be an object");
        }
        return {
          status: "loaded",
          value: { document, cues: animationSoundCues(document), revision: content.value.revision },
        };
      } catch (error) {
        return { status: "error", error: error instanceof Error ? error : new Error(String(error)) };
      }
    });
  }

  snapshot(): Content<AnimationAssetSnapshot> { return this.content(); }
  value(): AnimationAssetSnapshot {
    const content = this.content();
    if (content.status !== "loaded") throw new Error(`${this.id} is ${content.status}`);
    return content.value;
  }
  subscribe(listener: (content: Content<AnimationAssetSnapshot>) => void): () => void {
    return effect(() => listener(this.content()));
  }
  reload(): Promise<void> { return this.binary.reload(); }
  waitForSettled(): Promise<void> { return this.binary.waitForSettled(); }
  waitForIdle(): Promise<void> { return this.binary.waitForIdle(); }
  persistStatus(): PersistStatus { return this.binary.persistStatus(); }
  setDocument(document: AnimationDocument): void {
    this.binary.setBytes(new TextEncoder().encode(JSON.stringify(document)));
  }
}
