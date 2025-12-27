/**
 * 二进制解析和写入工具
 *
 * 提供用于读写 h5animate 二进制格式的工具类
 */

import { H5AnimateError, H5AnimateErrorCode } from "./errors.js";

/**
 * 二进制数据解析器
 *
 * 用于从 Buffer 中按顺序读取各种数据类型
 */
export class BinaryParser {
  private view: DataView;
  private offset: number = 0;

  constructor(private buffer: Buffer) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  /**
   * 读取一个 32 位无符号整数（小端序）
   */
  readUInt32LE(): number {
    this.checkBounds(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  /**
   * 读取指定长度的 ASCII 字符串
   */
  readString(length: number): string {
    this.checkBounds(length);
    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return bytes.toString("ascii");
  }

  /**
   * 读取指定长度的字节数据
   */
  readBytes(length: number): Buffer {
    this.checkBounds(length);
    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  /**
   * 检查是否还有更多数据可读
   */
  hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  /**
   * 获取当前偏移量
   */
  getCurrentOffset(): number {
    return this.offset;
  }

  /**
   * 获取剩余可读字节数
   */
  getRemainingBytes(): number {
    return this.buffer.length - this.offset;
  }

  /**
   * 检查边界，如果越界则抛出错误
   */
  private checkBounds(bytesToRead: number): void {
    if (this.offset + bytesToRead > this.buffer.length) {
      throw new H5AnimateError(
        H5AnimateErrorCode.CORRUPTED_HEADER,
        `读取越界: 尝试在位置 ${this.offset} 读取 ${bytesToRead} 字节，但缓冲区只有 ${this.buffer.length} 字节`,
        { position: this.offset },
      );
    }
  }
}

/**
 * 二进制数据写入器
 *
 * 用于向 Buffer 中按顺序写入各种数据类型
 */
export class BinaryWriter {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(totalSize: number) {
    this.buffer = Buffer.allocUnsafe(totalSize);
  }

  /**
   * 写入 ASCII 字符串
   */
  writeString(value: string): void {
    const bytesWritten = this.buffer.write(value, this.offset, "ascii");
    this.offset += bytesWritten;
  }

  /**
   * 写入一个 32 位无符号整数（小端序）
   */
  writeUInt32LE(value: number): void {
    this.buffer.writeUInt32LE(value, this.offset);
    this.offset += 4;
  }

  /**
   * 写入 Buffer 数据
   */
  writeBuffer(source: Buffer): void {
    source.copy(this.buffer, this.offset);
    this.offset += source.length;
  }

  /**
   * 获取写入的 Buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * 获取当前偏移量
   */
  getCurrentOffset(): number {
    return this.offset;
  }
}
