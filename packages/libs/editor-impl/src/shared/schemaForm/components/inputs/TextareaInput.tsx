import { Input } from 'antd';
import { ChangeEvent, ComponentRef, ReactElement, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
 * JSON 文本域控件：显示值的 JSON，失焦时解析提交，解析失败则恢复为最后一次合法值
 *
 * 自适应高度只在能真正排版的环境里开启：无排版引擎的窗口（如 jsdom）里真实文本域的
 * `scrollHeight` 恒为 0，antd 的 `autoSize` 会把高度算成 `NaN`。挂载后量一次挂在组件上的
 * 真实节点即可判定，不再借 `document` 新建探针元素（那会绕过 `document` 全局门禁）。
 * @param props 控件 props
 * @returns 文本域元素
 */
export function TextareaInput(props: ITextareaInputProps): ReactElement {
  const indent = props.indent ?? 0;
  const [text, setText] = useState(() => toText(props.value, indent));
  const [autoSize, setAutoSize] = useState<typeof TEXTAREA_AUTO_SIZE | undefined>(undefined);
  const textAreaRef = useRef<ComponentRef<typeof Input.TextArea>>(null);

  useEffect((): void => setText(toText(props.value, indent)), [props.value, indent]);

  useLayoutEffect((): void => {
    const element = textAreaRef.current?.resizableTextArea?.textArea;

    if (element !== undefined && element.scrollHeight > 0) setAutoSize(TEXTAREA_AUTO_SIZE);
  }, []);

  return (
    <Input.TextArea
      ref={textAreaRef}
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
