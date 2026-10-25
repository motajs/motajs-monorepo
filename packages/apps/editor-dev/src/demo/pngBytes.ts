// 开发宿主的二进制素材解码：Vite 的 `?inline` 把图片文件变成 data URL，
// 这里把 base64 正文还原成原始字节，好让演示宿主把真实素材 seed 进内存后端。
// 只做解码、不做校验；是不是合法 PNG 由调用方的测试断言。

/** data URL 里正文之前的分隔符：逗号之后就是 base64 文本 */
const DATA_URL_SEPARATOR = ',';

/**
 * 把 `data:image/png;base64,...` 形式的地址解码成原始字节
 * @param dataUrl `?inline` 导入得到的 data URL
 * @returns 解码后的原始字节
 */
export function decodeDataUrlBytes(dataUrl: string): Uint8Array {
  const separator = dataUrl.indexOf(DATA_URL_SEPARATOR);
  const text = separator >= 0 ? dataUrl.slice(separator + 1) : dataUrl;
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  return bytes;
}
