import { useState, ReactElement } from 'react';
import { css } from '@styled-system/css';

// Phase 2 脚手架探针（D-03）
// 它唯一的用途是让 core 的构建管线可观测：携带一次模板字面量 PandaCSS 调用（PKG-04 的
// 提取目标）并调用一个 hook（无 hook 的模块不会产生 React Compiler 标记，PKG-05/D-21）
// Phase 4 起由真实 React 层替换或删除，它不得成为公开 API，也不得从能力 subpath 再导出

interface CoreProbeProps {
  /** 探针的显示文本。 */
  readonly label?: string;
}

export function CoreProbe({ label = 'editor-core probe' }: CoreProbeProps): ReactElement {
  const [count] = useState(0);

  return (
    <div
      className={css`
        display: block;
      `}
    >{`${label}:${count}`}</div>
  );
}
