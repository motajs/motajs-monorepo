import { Input, Modal } from 'antd';
import { ReactElement, useRef, useState } from 'react';
import {
  CapabilityProvider,
  ICodeEditorOpener,
  ICodeEditorOpenRequest,
  ITableCapabilitiesProviderProps,
} from '@motajs/editor-impl/react';

// 开发宿主的代码编辑器能力：在既有的 CapabilityProvider 之上追加一个由 antd Modal + 多行文本域实现的
// codeEditor 打开器，令表格工具栏「更多 → 在代码编辑器中打开」在开发宿主中真正可用。本文件只服务开发
// 宿主、不进产品路径，也不改动 editor-core / editor-impl 的任何契约（ICodeEditorOpener 原样复用）。

/** 待解决的代码编辑器请求的 resolve 函数 */
type CodeEditorResolver = (value: string | null) => void;

/**
 * 开发宿主代码编辑器 Provider：把注入的能力包原样透传给 CapabilityProvider，并额外注入 codeEditor
 *
 * 打开器以 antd Modal + 多行文本域承载：打开时把该栏当前视图对应的文件原文填入文本域，确定交回当前
 * 文本、取消交回 null；两者都会调用 resolver，避免表格侧一直等待。写回合法性由表格面板侧的
 * `parseTableText` 把关，本组件只做文本编辑、不解析、不校验、不拼路径。
 * @param props Provider props，携带能力包与子树（复用既有 `ITableCapabilitiesProviderProps`）
 * @returns Provider 元素
 */
export function DevCodeEditorProvider(props: ITableCapabilitiesProviderProps): ReactElement {
  const requestState = useState<ICodeEditorOpenRequest | undefined>(undefined);
  const request = requestState[0];
  const setRequest = requestState[1];
  const textState = useState<string>('');
  const text = textState[0];
  const setText = textState[1];
  const resolver = useRef<CodeEditorResolver | undefined>(undefined);

  const opener: ICodeEditorOpener = {
    open: (next) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve;
        setRequest(next);
        setText(next.content);
      }),
  };

  const handleConfirm = (): void => {
    const resolve = resolver.current;

    resolver.current = undefined;
    setRequest(undefined);

    if (resolve !== undefined) resolve(text);
  };

  const handleCancel = (): void => {
    const resolve = resolver.current;

    resolver.current = undefined;
    setRequest(undefined);

    if (resolve !== undefined) resolve(null);
  };

  return (
    <>
      <CapabilityProvider capabilities={{ ...props.capabilities, codeEditor: opener }}>
        {props.children}
      </CapabilityProvider>
      {request === undefined ? null : (
        <Modal
          open
          title={request.title}
          data-test-id="dev-code-editor"
          width={720}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ 'data-test-id': 'dev-code-editor-confirm' }}
          cancelButtonProps={{ 'data-test-id': 'dev-code-editor-cancel' }}
          onOk={handleConfirm}
          onCancel={handleCancel}
        >
          <Input.TextArea
            data-test-id="dev-code-editor-text"
            value={text}
            autoSize={{ minRows: 12, maxRows: 24 }}
            onChange={(event): void => setText(event.target.value)}
          />
        </Modal>
      )}
    </>
  );
}
