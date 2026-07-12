/**
 * Base64 编码/解码工具
 *
 * 提供 UTF-8 安全的 Base64 编码和解码功能。
 * 从 editor.util.encode64/decode64 迁移而来。
 */

/**
 * 将字符串编码为 Base64（UTF-8 安全）
 *
 * 使用 encodeURIComponent 先将 UTF-8 字符串转换为 percent-encoding，
 * 然后转换为 Latin-1 字符串，最后使用 btoa 编码为 Base64。
 *
 * @param str - 要编码的字符串
 * @returns Base64 编码后的字符串
 *
 * @example
 * ```ts
 * encode64("Hello, 世界!") // => "SGVsbG8sIOS4lueVjCE="
 * ```
 */
export function encode64(str: string): string {
  if (!str) return "";
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
}

/**
 * 将 Base64 字符串解码为原始字符串（UTF-8 安全）
 *
 * 支持标准 Base64 和 URL-safe Base64（将 - 替换为 +，_ 替换为 /）。
 * 解码后将 Latin-1 字符串转换回 UTF-8。
 *
 * @param str - Base64 编码的字符串
 * @returns 解码后的原始字符串
 *
 * @example
 * ```ts
 * decode64("SGVsbG8sIOS4lueVjCE=") // => "Hello, 世界!"
 * ```
 */
export function decode64(str: string): string {
  if (!str) return "";
  // 支持 URL-safe Base64：将 - 替换为 +，_ 替换为 /，移除空白
  const normalizedStr = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  return decodeURIComponent(
    atob(normalizedStr)
      .split("")
      .map((c) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
}
