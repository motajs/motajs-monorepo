import { useEffect, useRef, type FC } from 'react';
import { useCurrentFloorId } from '@/stores/editorState';
import { projectAssets } from '@/project/assets';
import type { UIData } from '../shared/types';

interface PreviewUIContentProps {
  list: UIData[];
  background: string;
}

const SIZE = 416;

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function colour(value: unknown, fallback = '#ffffff'): string {
  if (typeof value === 'string' && value) return value;
  if (!Array.isArray(value)) return fallback;
  const [r = 255, g = 255, b = 255, a = 1] = value;
  return `rgba(${r},${g},${b},${a})`;
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number): void {
  const chars = Array.from(text);
  let line = '';
  let lineY = y;
  for (const char of chars) {
    if (char === '\n' || ctx.measureText(line + char).width > width) {
      ctx.fillText(line, x, lineY);
      line = char === '\n' ? '' : char;
      lineY += 24;
    } else line += char;
  }
  if (line) ctx.fillText(line, x, lineY);
}

async function loadProjectImage(name: string): Promise<ImageBitmap | null> {
  const path = name.includes('/') ? `project/${name.replace(/^project\//, '')}` : `project/images/${name}`;
  const resource = projectAssets.image(path);
  if (resource.snapshot().status === 'idle') await resource.reload();
  const content = resource.snapshot();
  if (content.status !== 'loaded') return null;
  const bytes = new Uint8Array(content.value.bytes);
  return createImageBitmap(new Blob([bytes.buffer], { type: 'image/png' }));
}

async function drawEvent(
  ctx: CanvasRenderingContext2D,
  raw: UIData,
  isCancelled: () => boolean,
): Promise<void> {
  const data = typeof raw === 'string' ? { type: 'text', text: raw } : raw;
  if (!data || typeof data !== 'object') return;
  const event = data as Record<string, unknown>;
  const type = String(event.type ?? '');
  if (type === 'setAttribute') {
    if (event.font) ctx.font = String(event.font);
    if (event.fillStyle) ctx.fillStyle = colour(event.fillStyle);
    if (event.strokeStyle) ctx.strokeStyle = colour(event.strokeStyle);
    if (event.lineWidth != null) ctx.lineWidth = number(event.lineWidth, 1);
    if (event.alpha != null) ctx.globalAlpha = number(event.alpha, 1);
    if (event.align) ctx.textAlign = event.align as CanvasTextAlign;
    if (event.baseline) ctx.textBaseline = event.baseline as CanvasTextBaseline;
    return;
  }
  if (type === 'clearMap') {
    ctx.clearRect(number(event.x), number(event.y), number(event.width, SIZE), number(event.height, SIZE));
    return;
  }
  if (type === 'fillRect' || type === 'strokeRect') {
    ctx.save();
    ctx.fillStyle = colour(event.style, String(ctx.fillStyle));
    ctx.strokeStyle = colour(event.style, String(ctx.strokeStyle));
    const args = [number(event.x), number(event.y), number(event.width), number(event.height)] as const;
    if (type === 'fillRect') ctx.fillRect(...args);
    else ctx.strokeRect(...args);
    ctx.restore();
    return;
  }
  if (type === 'fillText' || type === 'fillBoldText') {
    ctx.save();
    if (event.font) ctx.font = String(event.font);
    ctx.fillStyle = colour(event.style, String(ctx.fillStyle));
    if (type === 'fillBoldText') {
      ctx.strokeStyle = colour(event.strokeStyle, '#000000');
      ctx.strokeText(String(event.text ?? ''), number(event.x), number(event.y));
    }
    ctx.fillText(String(event.text ?? ''), number(event.x), number(event.y));
    ctx.restore();
    return;
  }
  if (type === 'text' || type === 'choices' || type === 'confirm') {
    const text = String(event.text ?? '');
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#111827';
    ctx.fillRect(16, 245, SIZE - 32, 150);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f8fafc';
    ctx.strokeRect(16, 245, SIZE - 32, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    drawWrappedText(ctx, text, 30, 274, SIZE - 60);
    if (type === 'choices') {
      const choices = Array.isArray(event.choices) ? event.choices : [];
      choices.slice(0, 4).forEach((choice, index) => {
        const label = typeof choice === 'string' ? choice : String((choice as Record<string, unknown>).text ?? '');
        ctx.fillText(`${index === number(event.selected) ? '> ' : '  '}${label}`, 45, 315 + index * 20);
      });
    }
    if (type === 'confirm') ctx.fillText('确定     取消', 135, 360);
    ctx.restore();
    return;
  }
  if (type === 'drawImage' && typeof event.image === 'string') {
    const image = await loadProjectImage(event.image);
    if (!image || isCancelled()) return;
    const x = number(event.x); const y = number(event.y);
    if (event.x1 != null) {
      ctx.drawImage(image, number(event.x1), number(event.y1), number(event.w1), number(event.h1),
        x, y, number(event.w, number(event.w1)), number(event.h, number(event.h1)));
    } else ctx.drawImage(image, x, y, number(event.w, image.width), number(event.h, image.height));
    image.close();
  }
}

export const PreviewUIContent: FC<PreviewUIContentProps> = ({ list, background }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floorId = useCurrentFloorId();

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = background === 'thumbnail' ? '#20242b' : background;
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (background === 'thumbnail') {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText(floorId ?? '', 10, 20);
    }
    void (async () => {
      for (const item of list) {
        await drawEvent(ctx, item, () => cancelled);
        if (cancelled) return;
      }
    })();
    return () => { cancelled = true; };
  }, [background, floorId, list]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="gameCanvas"
        id="uievent"
        data-test-id="blockly-static-preview"
        style={{ position: "static", display: "block" }}
      />
      <div id="uieventExtraBody" style={{ display: 'none', marginTop: '-10px' }} />
    </>
  );
};
