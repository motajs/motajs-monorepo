import {
  projectAssets,
  withAnimationSoundCues,
  type AnimationAssetResource,
  type AnimationDocument,
  type AnimationSoundCue,
} from '@/project/assets';
import {
  operationHistory,
  type AppliedOperation,
  type EditorOperation,
  type OperationMeta,
} from '@/project/history';
import { commandError, commandOk, type CommandResult } from './types';

function animationPath(name: string): string {
  const file = name.endsWith('.animate') ? name : `${name}.animate`;
  return `project/animates/${file}`;
}

class WriteAnimationOperation implements EditorOperation {
  readonly meta: OperationMeta;
  private readonly resource: AnimationAssetResource;
  private readonly document: AnimationDocument;
  constructor(meta: OperationMeta, resource: AnimationAssetResource, document: AnimationDocument) {
    this.meta = meta;
    this.resource = resource;
    this.document = document;
  }
  async apply(): Promise<AppliedOperation<void>> {
    const previous = structuredClone(this.resource.value().document);
    const nextText = JSON.stringify(this.document);
    if (JSON.stringify(previous) === nextText) return { value: undefined, inverse: this, changed: false };
    this.resource.setDocument(this.document);
    return {
      value: undefined,
      inverse: new WriteAnimationOperation(this.meta, this.resource, previous),
      changed: true,
    };
  }
}

class AnimationCommands {
  async setSoundCues(name: string, cues: AnimationSoundCue[]): Promise<CommandResult> {
    const path = animationPath(name);
    const resource = projectAssets.animation(path);
    try {
      await resource.ensureLoaded();
      const snapshot = resource.value();
      const frameMax = Number(snapshot.document.frame_max ?? snapshot.document.frames?.length ?? 0);
      for (const cue of cues) {
        if (!Number.isInteger(cue.frame) || cue.frame < 1 || (frameMax > 0 && cue.frame > frameMax)) {
          return commandError('animation-cues:validate', new Error(`Invalid animation frame ${cue.frame}`));
        }
        if (!cue.sound) return commandError('animation-cues:validate', new Error('Sound name is required'));
        if (!Number.isFinite(cue.pitch) || cue.pitch < 30 || cue.pitch > 300) {
          return commandError('animation-cues:validate', new Error('Pitch must be between 30 and 300'));
        }
      }
      await operationHistory.execute(
        new WriteAnimationOperation(
          { label: `修改动画音效 ${name.replace(/\.animate$/i, '')}`, stage: 'animation-cues:asset' },
          resource,
          withAnimationSoundCues(snapshot.document, cues),
        ),
      );
      return commandOk();
    } catch (error) {
      const stage = resource.snapshot().status === 'error' ? 'animation-cues:parse' : 'animation-cues:asset';
      return commandError(stage, error);
    }
  }
}

export const animationCommands = new AnimationCommands();
