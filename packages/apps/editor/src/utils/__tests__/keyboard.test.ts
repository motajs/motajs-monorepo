import { describe, expect, it } from 'vitest';
import { isKeyboardInputTarget, isVisibleKeyboardScope } from '../keyboard';

describe('keyboard shortcut scope', () => {
  it('treats native and hosted code editor inputs as typing targets', () => {
    const input = document.createElement('input');
    const monaco = document.createElement('div');
    monaco.className = 'monaco-editor';
    const textarea = document.createElement('textarea');
    monaco.append(textarea);

    expect(isKeyboardInputTarget(input)).toBe(true);
    expect(isKeyboardInputTarget(textarea)).toBe(true);
    expect(isKeyboardInputTarget(document.createElement('button'))).toBe(false);
  });

  it('rejects detached keyboard scopes', () => {
    expect(isVisibleKeyboardScope(document.createElement('div'))).toBe(false);
  });
});
