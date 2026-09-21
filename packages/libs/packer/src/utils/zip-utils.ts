import JSZip from 'jszip';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import iconvLite from 'iconv-lite';
import type { FileEntry } from '../types';

// 重新导出 FileEntry 类型供外部使用
export type { FileEntry } from '../types';

// iconv-lite ESM compatibility
const iconv = iconvLite as unknown as {
  decode: (buffer: Buffer, encoding: string) => string;
  encode: (str: string, encoding: string) => Buffer;
};

/**
 * 解码 GBK 编码的文件名
 * @param buffer 原始字节数据
 * @returns UTF-8 字符串
 */
export function decodeGbkFilename(buffer: Buffer): string {
  return iconv.decode(buffer, 'gbk');
}

/**
 * 检测文件名是否需要 GBK 解码
 * 如果文件名包含无效的 UTF-8 序列，则尝试 GBK 解码
 * @param filename 原始文件名
 * @returns 解码后的文件名
 */
function tryDecodeFilename(filename: string): string {
  // 检查是否包含乱码特征（常见于 GBK 编码的中文）
  // 如果文件名看起来正常，直接返回
  try {
    // 尝试将字符串转为 Buffer 再用 GBK 解码
    const buffer = Buffer.from(filename, 'binary');
    const decoded = iconv.decode(buffer, 'gbk');

    // 如果解码后包含中文字符，使用解码后的版本
    if (/[\u4e00-\u9fa5]/.test(decoded) && !decoded.includes('�')) {
      return decoded;
    }
  } catch {
    // 解码失败，返回原始文件名
  }
  return filename;
}

/**
 * 解压 ZIP 文件到指定目录
 * @param zipPath ZIP 文件路径
 * @param destDir 目标目录
 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const zipData = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipData);

  const entries = Object.entries(zip.files);

  for (const [filename, file] of entries) {
    // 尝试解码 GBK 文件名
    const decodedName = tryDecodeFilename(filename);
    const destPath = join(destDir, decodedName);

    if (file.dir) {
      await mkdir(destPath, { recursive: true });
    } else {
      // 确保父目录存在
      await mkdir(dirname(destPath), { recursive: true });
      const content = await file.async('nodebuffer');
      await writeFile(destPath, content);
    }
  }
}

/**
 * 创建 ZIP 文件
 * @param files 文件条目列表
 * @param outputPath 输出路径
 */
export async function createZip(files: FileEntry[], outputPath: string): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  // 确保输出目录存在
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
}

/**
 * 从目录创建 ZIP 文件
 * @param sourceDir 源目录
 * @param files 要包含的文件列表（相对于 sourceDir）
 * @param outputPath 输出路径
 * @param transform 可选的文件名转换函数
 */
export async function createZipFromDir(
  sourceDir: string,
  files: string[],
  outputPath: string,
  transform?: (filename: string) => string,
): Promise<void> {
  const entries: FileEntry[] = [];

  for (const file of files) {
    const filePath = join(sourceDir, file);
    try {
      const content = await readFile(filePath);
      const name = transform ? transform(file) : file;
      entries.push({ name, content });
    } catch {
      // 文件不存在，跳过
    }
  }

  await createZip(entries, outputPath);
}

/**
 * 获取 ZIP 文件中的文件列表
 * @param zipPath ZIP 文件路径
 * @returns 文件名列表
 */
export async function listZipFiles(zipPath: string): Promise<string[]> {
  const zipData = await readFile(zipPath);
  const zip = await JSZip.loadAsync(zipData);

  return Object.keys(zip.files).filter((name) => !zip.files[name].dir);
}

/**
 * 获取 ZIP 文件中的文件数量
 * @param zipPath ZIP 文件路径
 * @returns 文件数量（不包括目录）
 */
export async function getZipFileCount(zipPath: string): Promise<number> {
  const files = await listZipFiles(zipPath);
  return files.length;
}
