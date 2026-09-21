export function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    Boolean(target.closest('.monaco-editor, .CodeMirror, .blocklyWidgetDiv, .blocklyHtmlInput'))
  );
}

export function isVisibleKeyboardScope(element: HTMLElement | null): boolean {
  return Boolean(element?.isConnected && element.getClientRects().length > 0);
}
