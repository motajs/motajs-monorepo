import { ReactElement } from 'react';
import '../schemaForm.css';

/** schema 提示条的固定文案 */
const SCHEMA_BANNER_TEXT = '正在编辑表格结构（Schema）';

export interface ISchemaBannerProps {
  /** 提示条展示的文本，缺省时为固定文案 */
  readonly text?: string;
}

/**
 * schema 模式提示条：网格上方一行 muted 文本，窄面板下省略号截断并暴露 title
 * @param props 提示条 props
 * @returns 提示条元素
 */
export function SchemaBanner(props: ISchemaBannerProps): ReactElement {
  const text = props.text ?? SCHEMA_BANNER_TEXT;

  return (
    <div className="etable-schema-banner" data-test-id="schema-banner" title={text}>
      {text}
    </div>
  );
}
