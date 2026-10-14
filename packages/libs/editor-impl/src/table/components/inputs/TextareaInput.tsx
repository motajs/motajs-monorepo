import { Input } from 'antd';
import { ChangeEvent, ReactElement, useEffect, useState } from 'react';

/** antd 值文本域的自适应高度配置：最小 1 行、随内容增高、最多 6 行（P28） */
const TEXTAREA_AUTO_SIZE = { minRows: 1, maxRows: 6 } as const;

export interface ITextareaInputProps {
  /** 当前值，显示为其 JSON 文本 */
  readonly value: unknown;
  /** 提交解析后的新值 */
  readonly onChange: (value: unknown) => void;
  /** JSON 缩进空格数，缺省为 0 */
  readonly indent?: number;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 把值序列化为用于编辑的 JSON 文本
 * @param value 字段值
 * @param indent 缩进空格数
 * @returns JSON 文本；无法序列化时为空串
 */
function toText(value: unknown, indent: number): string {
  return JSON.stringify(value, null, indent) ?? '';
}

/**
 * 解析编辑框文本：空白文本视为 null，非法 JSON 视为解析失败
 * @param text 编辑框文本
 * @returns 解析结果，ok 为 false 时 value 无意义
 */
function parseText(text: string): { readonly ok: boolean; readonly value?: unknown } {
  const trimmed = text.trim();

  if (trimmed === '') return { ok: true, value: null };

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false };
  }
}

/**
 * 探测当前窗口能否算出文本域的排版尺寸：antd `autoSize` 依赖 `scrollHeight` 测量高度，
 * 无排版引擎的窗口（如 jsdom）`scrollHeight` 恒为 0、高度算成 `NaN`，测量既无结果又昂贵
 * （每个文本域都要 `getComputedStyle` 遍历整份样式表）。
 * @returns 有真实排版引擎时为 true；窗口不可测量时为 false
 */
function canMeasureTextareaHeight(window: Window): boolean {
  const probe = window.document.createElement('textarea');

  probe.value = 'x';
  window.document.body.appendChild(probe);

  const measurable = probe.scrollHeight > 0;

  probe.remove();

  return measurable;
}

/**
 * JSON 文本域控件：显示值的 JSON，失焦时解析提交，解析失败则恢复为最后一次合法值
 * @param props 控件 props
 * @returns 文本域元素
 */
export function TextareaInput(props: ITextareaInputProps): ReactElement {
  const indent = props.indent ?? 0;
  const [text, setText] = useState(() => toText(props.value, indent));

  useEffect((): void => setText(toText(props.value, indent)), [props.value, indent]);

  const autoSize = canMeasureTextareaHeight(window) ? TEXTAREA_AUTO_SIZE : undefined;

  return (
    <Input.TextArea
      className="etable-input-textarea"
      size="small"
      spellCheck={false}
      autoSize={autoSize}
      disabled={props.disabled}
      value={text}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => setText(event.target.value)}
      onBlur={(): void => {
        const parsed = parseText(text);

        if (parsed.ok) props.onChange(parsed.value);
        else setText(toText(props.value, indent));
      }}
    />
  );
}
