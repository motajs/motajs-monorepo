import { ReactElement } from 'react';

export interface IAssetFontSampleProps {
  /** 字体文件的资源路径，用于生成稳定的 CSS 字体族名 */
  readonly path: string;
  /** 字体文件的 `blob:` 地址；尚未读到时为 undefined，此时只渲染文本 */
  readonly url?: string;
  /** 用该字体渲染的样例文字 */
  readonly text: string;
  /** 附加在样例节点上的类名 */
  readonly className?: string;
}

/** FNV-1a 哈希的初始值 */
const FNV_OFFSET_BASIS = 0x811c9dc5;

/** FNV-1a 哈希的乘数 */
const FNV_PRIME = 0x01000193;

/**
 * 由素材路径生成 CSS 字体族名
 *
 * 族名不携带原始路径：原始路径会进入 `<style>` 文本，一旦含引号 / 分号就会变成样式注入面。
 * @param path 字体文件的资源路径
 * @returns 形如 `asset-font-1a2b3c4d` 的族名
 */
function resolveAssetFontFamily(path: string): string {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return `asset-font-${hash.toString(16).padStart(8, '0')}`;
}

/**
 * 用给定 `blob:` 地址为字体写一段样例文字
 *
 * `@font-face` 的正文经 React 文本子节点写入（不用 `dangerouslySetInnerHTML`）；族名由路径哈希得出，
 * 地址只来自 `URL.createObjectURL`，因此 `<style>` 里不会出现素材内容拼出的任意文本。
 * @param props 字体样例 props
 * @returns 样例文字（带地址时额外附带一条 `@font-face` 规则）
 */
export function AssetFontSample(props: IAssetFontSampleProps): ReactElement {
  const url = props.url;

  if (url === undefined) {
    return (
      <span data-test-id="asset-font-sample" className={props.className}>
        {props.text}
      </span>
    );
  }

  const family = resolveAssetFontFamily(props.path);

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
