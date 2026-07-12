import type { UIData } from '@/Workbench/modals/shared/types';
import type { BlocklyPreviewAdapterId } from '../registry';

export interface BlocklyInteractionDiagnostic {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface RuntimePreviewRequest {
  adapter: BlocklyPreviewAdapterId;
  event: unknown;
}

export interface BlocklyPreviewResult {
  staticPreview: UIData[];
  diagnostics: BlocklyInteractionDiagnostic[];
  runtimeRequest?: RuntimePreviewRequest;
}

function finiteNumber(value: string): number | undefined {
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : undefined;
}

export function parseTextDrawingPreview(content: string): UIData[] {
  const result: UIData[] = [];
  content.replace(/(?:\\f|\f)\[(.*?)]/g, (_text, raw: string) => {
    const values = raw.split(',').map((item) => item.trim());
    if (![3, 5].includes(values.length) && values.length < 9) return '';
    const numbers = values.slice(1).map(finiteNumber);
    if (numbers.some((value) => value === undefined)) return '';
    let image = values[0];
    const data: Record<string, unknown> = { type: 'drawImage' };
    const reverse = image.match(/:(o|x|y)$/)?.[1];
    if (reverse) {
      data.reverse = reverse;
      image = image.slice(0, -2);
    }
    data.image = image;
    [data.x, data.y] = numbers;
    if (values.length >= 5) [data.w, data.h] = numbers.slice(2);
    if (values.length >= 9) [data.x1, data.y1, data.w1, data.h1] = numbers.slice(4);
    if (values.length >= 10) result.push({ type: 'setAttribute', alpha: numbers[8] });
    if (values.length >= 11) data.angle = numbers[9];
    result.push(data);
    return '';
  });
  return result;
}

export function buildBlocklyPreview(
  event: unknown,
  adapter: BlocklyPreviewAdapterId,
): BlocklyPreviewResult {
  const diagnostics: BlocklyInteractionDiagnostic[] = [];
  let staticPreview: UIData[] = [];

  if (adapter === 'textDrawing') {
    const content = typeof event === 'string'
      ? event
      : String((event as Record<string, unknown> | null)?.text ?? '');
    staticPreview = parseTextDrawingPreview(content);
    if (staticPreview.length === 0) diagnostics.push({
      code: 'preview.text-drawing-empty',
      message: '没有找到可静态预览的绘图转义指令',
      severity: 'info',
    });
  } else if (adapter === 'floorImage' && event && typeof event === 'object') {
    const image = event as Record<string, unknown>;
    if (typeof image.name === 'string') {
      const preview: Record<string, unknown> = {
        type: 'drawImage', image: image.name, x: image.x ?? 0, y: image.y ?? 0,
      };
      if (image.sx != null) {
        preview.x1 = image.sx; preview.y1 = image.sy ?? 0;
        preview.w1 = image.w; preview.h1 = image.h;
        preview.w = image.w; preview.h = image.h;
      }
      staticPreview = [preview];
    }
  } else if (event && typeof event === 'object') {
    const record = event as Record<string, unknown>;
    if (record.type === 'previewUI') {
      staticPreview = Array.isArray(record.action) ? record.action as UIData[] : [];
    } else if (adapter === 'waitRect') {
      const px = Array.isArray(record.px) ? record.px : [];
      const py = Array.isArray(record.py) ? record.py : [];
      if (px.length >= 2 && py.length >= 2) {
        staticPreview = [{
          type: 'fillRect', x: px[0], y: py[0],
          width: Number(px[1]) - Number(px[0]),
          height: Number(py[1]) - Number(py[0]),
          style: [255, 0, 0, 0.4],
        }];
      }
    } else {
      staticPreview = [record];
    }
  } else if (typeof event === 'string') {
    staticPreview = [event];
  }

  if (staticPreview.length === 0 && diagnostics.length === 0) diagnostics.push({
    code: 'preview.unsupported',
    message: '该事件包含无法静态确认的预览数据，可在 runtime 可用时尝试增强预览',
    severity: 'warning',
  });

  return {
    staticPreview,
    diagnostics,
    runtimeRequest: { adapter, event },
  };
}
