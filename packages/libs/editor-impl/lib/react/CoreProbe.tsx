import { useState, ReactElement } from 'react';
import { css } from '@styled-system/css';

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
