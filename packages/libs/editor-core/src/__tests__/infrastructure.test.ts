import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

describe('渲染测试基础设施', () => {
  // 渲染一个文本节点并断言 screen 能查到，证明 jsdom + react-dom + @testing-library/react 端到端可用
  it('renders a text node into jsdom and finds it via screen', () => {
    render(createElement('div', null, 'editor-core smoke'));

    expect(screen.getByText('editor-core smoke')).not.toBeNull();
  });
});
