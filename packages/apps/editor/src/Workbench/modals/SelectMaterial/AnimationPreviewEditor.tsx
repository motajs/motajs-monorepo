import { useEffect, useRef, useState, type FC } from "react";
import { projectAssets, type AnimationSoundCue } from "@/project/assets";
import { animationCommands } from "@/project/commands/animationCommands";
import { useCurrentFloorId } from "@/stores/editorState";
import { notifyCommandResult, notifyError } from "@/utils/notify";
import { FloorThumbnail } from "../shared/FloorThumbnail";

function useObjectUrl(path: string): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const resource = projectAssets.image(path);
    let current = "";
    const dispose = resource.subscribe((content) => {
      if (content.status !== "loaded") return;
      if (current) URL.revokeObjectURL(current);
      current = URL.createObjectURL(new Blob([content.value.bytes.slice().buffer]));
      setUrl(current);
    });
    void resource.reload();
    return () => {
      dispose();
      if (current) URL.revokeObjectURL(current);
    };
  }, [path]);
  return url;
}

function drawAnimationFrame(
  context: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  frames: unknown[][],
  ratio: number,
  frame: number,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  const items = frames[frame % frames.length];
  if (!Array.isArray(items)) return;
  for (const raw of items) {
    if (!Array.isArray(raw)) continue;
    const [index, x = 0, y = 0, zoom = 100, opacity = 255, mirror = 0, angle = 0] = raw.map(Number);
    const image = images[index];
    if (!image?.complete || !image.naturalWidth) continue;
    const width = image.naturalWidth * ratio * zoom / 100;
    const height = image.naturalHeight * ratio * zoom / 100;
    context.save();
    context.globalAlpha = opacity / 255;
    context.translate(context.canvas.width / 2 + x, context.canvas.height / 2 + y);
    context.rotate(-angle * Math.PI / 180);
    context.scale(mirror ? -1 : 1, 1);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  }
}

const CueSoundPreview: FC<{ sound: string; pitch: number }> = ({ sound, pitch }) => {
  const url = useObjectUrl(`project/sounds/${sound}`);
  const play = () => {
    if (!url) return;
    const audio = new Audio(url);
    audio.preservesPitch = false;
    audio.playbackRate = pitch / 100;
    void audio.play();
  };
  return <button data-test-id="animation-cue-preview" onClick={play}>试听</button>;
};

export const AnimationPreviewEditor: FC<{ name: string; path: string }> = ({ name, path }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameRef = useRef(0);
  const [document, setDocument] = useState<Record<string, unknown> | null>(null);
  const [cues, setCues] = useState<AnimationSoundCue[]>([]);
  const [sounds, setSounds] = useState<string[]>([]);
  const floorId = useCurrentFloorId();

  useEffect(() => {
    const resource = projectAssets.animation(path);
    const dispose = resource.subscribe((content) => {
      if (content.status === "error") notifyError(`动画读取失败：${content.error.message}`);
      if (content.status !== "loaded") return;
      setDocument(content.value.document);
      setCues(content.value.cues);
      imagesRef.current = (content.value.document.bitmaps ?? []).map((source) => {
        const image = new Image();
        if (source) image.src = source;
        return image;
      });
      frameRef.current = 0;
    });
    void resource.reload();
    return dispose;
  }, [path]);

  useEffect(() => {
    const directory = projectAssets.directory("project/sounds");
    const dispose = directory.subscribe((content) => {
      if (content.status === "loaded") setSounds(content.value.entries);
    });
    void directory.reload();
    return dispose;
  }, []);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    const frames = Array.isArray(document.frames) ? document.frames as unknown[][] : [];
    if (!frames.length) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const ratio = Number(document.ratio) || 1;
    const timer = window.setInterval(() => {
      drawAnimationFrame(context, imagesRef.current, frames, ratio, frameRef.current++);
    }, 50);
    return () => {
      window.clearInterval(timer);
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    };
  }, [document, path]);

  const frameMax = Math.max(1, Number(document?.frame_max ?? (document?.frames as unknown[] | undefined)?.length ?? 1));
  const updateCue = (index: number, patch: Partial<AnimationSoundCue>) => {
    setCues((current) => current.map((cue, cueIndex) => cueIndex === index ? { ...cue, ...patch } : cue));
  };
  const save = async () => {
    const result = await animationCommands.setSoundCues(name, cues);
    notifyCommandResult(result, "动画音效保存成功");
  };

  return (
    <div data-test-id={`animation-editor-${name}`} style={{ margin: "8px 0 16px 18px" }}>
      <div style={{ position: "relative", width: 416, height: 416 }}>
        {floorId && <FloorThumbnail floorId={floorId} style={{ position: "absolute", inset: 0, margin: 0 }} />}
        <canvas
          ref={canvasRef}
          width={416}
          height={416}
          data-test-id="animation-preview-canvas"
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
      <div data-test-id="animation-cues" style={{ marginTop: 8 }}>
        {cues.map((cue, index) => (
          <div key={`${index}-${cue.frame}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span>第</span>
            <select
              data-test-id={`animation-cue-frame-${index}`}
              value={cue.frame}
              onChange={(event) => updateCue(index, { frame: Number(event.target.value) })}
            >
              {Array.from({ length: frameMax }, (_, frame) => <option key={frame + 1}>{frame + 1}</option>)}
            </select>
            <span>帧：</span>
            <input
              data-test-id={`animation-cue-sound-${index}`}
              list="animation-sound-options"
              value={cue.sound}
              onChange={(event) => updateCue(index, { sound: event.target.value })}
            />
            <CueSoundPreview sound={cue.sound} pitch={cue.pitch} />
            <small>音调：</small>
            <input
              data-test-id={`animation-cue-pitch-${index}`}
              type="number"
              min={30}
              max={300}
              value={cue.pitch}
              style={{ width: 55 }}
              onChange={(event) => updateCue(index, { pitch: Number(event.target.value) })}
            />
            <button data-test-id={`animation-cue-delete-${index}`} onClick={() => setCues((current) => current.filter((_, cueIndex) => cueIndex !== index))}>删除</button>
          </div>
        ))}
        <datalist id="animation-sound-options">{sounds.map((sound) => <option key={sound} value={sound} />)}</datalist>
        <button
          data-test-id="animation-cue-add"
          onClick={() => setCues((current) => [...current, { frame: 1, sound: sounds[0] ?? "", pitch: 100 }])}
        >添加音效</button>
        <button data-test-id="animation-cue-save" style={{ marginLeft: 10 }} onClick={() => void save()}>保存</button>
      </div>
    </div>
  );
};
