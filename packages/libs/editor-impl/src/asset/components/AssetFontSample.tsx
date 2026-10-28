import { ReactElement } from 'react';

export interface IAssetFontSampleProps {
  /** 由面板生成且不含路径的稳定 CSS 字体族名 */
  readonly fontFamily: string;
  /** 字体文件的 `blob:` 地址；尚未读到时为 undefined，此时只渲染文本 */
  readonly url?: string;
  /** 用该字体渲染的样例文字 */
  readonly text: string;
  /** 附加在样例节点上的类名 */
  readonly className?: string;
}

/**
 * 用给定 `blob:` 地址为字体写一段样例文字
 *
 * `@font-face` 的正文经 React 文本子节点写入（不用 `dangerouslySetInnerHTML`）；族名由面板算好传入，
 * 组件不接触任何文件路径，`<style>` 里不会出现素材内容拼出的任意文本。
 * @param props 字体样例 props
 * @returns 样例文字（带地址时额外附带一条 `@font-face` 规则）
 */
export function AssetFontSample(props: IAssetFontSampleProps): ReactElement {
  const url = props.url;
  const family = props.fontFamily;

  if (url === undefined) {
    return (
      <span data-test-id="asset-font-sample" className={props.className}>
        {props.text}
      </span>
    );
  }

  return (
    <>
      <style data-test-id="asset-font-face">{`@font-face { font-family: '${family}'; src: url("${url}"); }`}</style>
      <span
        data-test-id="asset-font-sample"
        className={props.className}
        style={{ fontFamily: `'${family}', sans-serif` }}
      >
        {props.text}
      </span>
    </>
  );
}
