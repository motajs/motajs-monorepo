import { describe, test, expect } from "vitest";
import { BinaryParser, BinaryWriter } from "../binary";
import { H5AnimateError, H5AnimateErrorCode } from "../errors";

describe("BinaryParser", () => {
  describe("readUInt32LE", () => {
    test("应该正确读取小端序 32 位无符号整数", () => {
      // 0x12345678 in little-endian: 78 56 34 12
      const buffer = Buffer.from([0x78, 0x56, 0x34, 0x12]);
      const parser = new BinaryParser(buffer);

      expect(parser.readUInt32LE()).toBe(0x12345678);
    });

    test("应该正确更新偏移量", () => {
      const buffer = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]);
      const parser = new BinaryParser(buffer);

      expect(parser.getCurrentOffset()).toBe(0);
      parser.readUInt32LE();
      expect(parser.getCurrentOffset()).toBe(4);
      parser.readUInt32LE();
      expect(parser.getCurrentOffset()).toBe(8);
    });

    test("读取越界时应该抛出错误", () => {
      const buffer = Buffer.from([0x01, 0x02]); // 只有 2 字节
      const parser = new BinaryParser(buffer);

      expect(() => parser.readUInt32LE()).toThrow(H5AnimateError);
    });
  });

  describe("readString", () => {
    test("应该正确读取 ASCII 字符串", () => {
      const buffer = Buffer.from("ANIM", "ascii");
      const parser = new BinaryParser(buffer);

      expect(parser.readString(4)).toBe("ANIM");
    });

    test("应该正确更新偏移量", () => {
      const buffer = Buffer.from("ANIMTEST", "ascii");
      const parser = new BinaryParser(buffer);

      parser.readString(4);
      expect(parser.getCurrentOffset()).toBe(4);
      expect(parser.readString(4)).toBe("TEST");
    });

    test("读取越界时应该抛出错误", () => {
      const buffer = Buffer.from("AB", "ascii");
      const parser = new BinaryParser(buffer);

      expect(() => parser.readString(5)).toThrow(H5AnimateError);
    });
  });

  describe("readBytes", () => {
    test("应该正确读取字节数据", () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const parser = new BinaryParser(buffer);

      const bytes = parser.readBytes(3);
      expect(bytes).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    });

    test("应该正确更新偏移量", () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const parser = new BinaryParser(buffer);

      parser.readBytes(2);
      expect(parser.getCurrentOffset()).toBe(2);
    });

    test("读取越界时应该抛出错误", () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const parser = new BinaryParser(buffer);

      expect(() => parser.readBytes(5)).toThrow(H5AnimateError);
    });
  });

  describe("hasMore", () => {
    test("有剩余数据时应该返回 true", () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const parser = new BinaryParser(buffer);

      expect(parser.hasMore()).toBe(true);
    });

    test("读取完所有数据后应该返回 false", () => {
      const buffer = Buffer.from([0x01, 0x00, 0x00, 0x00]);
      const parser = new BinaryParser(buffer);

      parser.readUInt32LE();
      expect(parser.hasMore()).toBe(false);
    });
  });

  describe("getRemainingBytes", () => {
    test("应该返回正确的剩余字节数", () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const parser = new BinaryParser(buffer);

      expect(parser.getRemainingBytes()).toBe(5);
      parser.readBytes(2);
      expect(parser.getRemainingBytes()).toBe(3);
    });
  });

  describe("边界检查错误信息", () => {
    test("越界错误应该包含正确的错误代码和位置信息", () => {
      const buffer = Buffer.from([0x01, 0x02]);
      const parser = new BinaryParser(buffer);

      try {
        parser.readUInt32LE();
        expect.fail("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(H5AnimateError);
        const h5Error = error as H5AnimateError;
        expect(h5Error.code).toBe(H5AnimateErrorCode.CORRUPTED_HEADER);
        expect(h5Error.position).toBe(0);
      }
    });
  });
});

describe("BinaryWriter", () => {
  describe("writeUInt32LE", () => {
    test("应该正确写入小端序 32 位无符号整数", () => {
      const writer = new BinaryWriter(4);
      writer.writeUInt32LE(0x12345678);

      const buffer = writer.getBuffer();
      // 0x12345678 in little-endian: 78 56 34 12
      expect(buffer[0]).toBe(0x78);
      expect(buffer[1]).toBe(0x56);
      expect(buffer[2]).toBe(0x34);
      expect(buffer[3]).toBe(0x12);
    });

    test("应该正确更新偏移量", () => {
      const writer = new BinaryWriter(8);

      expect(writer.getCurrentOffset()).toBe(0);
      writer.writeUInt32LE(1);
      expect(writer.getCurrentOffset()).toBe(4);
      writer.writeUInt32LE(2);
      expect(writer.getCurrentOffset()).toBe(8);
    });
  });

  describe("writeString", () => {
    test("应该正确写入 ASCII 字符串", () => {
      const writer = new BinaryWriter(4);
      writer.writeString("ANIM");

      const buffer = writer.getBuffer();
      expect(buffer.toString("ascii")).toBe("ANIM");
    });

    test("应该正确更新偏移量", () => {
      const writer = new BinaryWriter(8);

      writer.writeString("ANIM");
      expect(writer.getCurrentOffset()).toBe(4);
    });
  });

  describe("writeBuffer", () => {
    test("应该正确写入 Buffer 数据", () => {
      const writer = new BinaryWriter(5);
      const source = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      writer.writeBuffer(source);

      expect(writer.getBuffer()).toEqual(source);
    });

    test("应该正确更新偏移量", () => {
      const writer = new BinaryWriter(10);
      const source = Buffer.from([0x01, 0x02, 0x03]);

      writer.writeBuffer(source);
      expect(writer.getCurrentOffset()).toBe(3);
    });
  });

  describe("getBuffer", () => {
    test("应该返回完整的缓冲区", () => {
      const writer = new BinaryWriter(8);
      writer.writeString("ANIM");
      writer.writeUInt32LE(1);

      const buffer = writer.getBuffer();
      expect(buffer.length).toBe(8);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("ANIM");
      expect(buffer.readUInt32LE(4)).toBe(1);
    });
  });
});

describe("BinaryParser 和 BinaryWriter 往返测试", () => {
  test("写入后读取应该得到相同的数据", () => {
    // 写入数据
    const writer = new BinaryWriter(16);
    writer.writeString("ANIM");
    writer.writeUInt32LE(1);
    writer.writeUInt32LE(100);
    writer.writeUInt32LE(200);

    // 读取数据
    const parser = new BinaryParser(writer.getBuffer());
    expect(parser.readString(4)).toBe("ANIM");
    expect(parser.readUInt32LE()).toBe(1);
    expect(parser.readUInt32LE()).toBe(100);
    expect(parser.readUInt32LE()).toBe(200);
    expect(parser.hasMore()).toBe(false);
  });

  test("混合数据类型的往返测试", () => {
    const testData = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);

    // 写入
    const writer = new BinaryWriter(12);
    writer.writeString("TEST");
    writer.writeBuffer(testData);
    writer.writeUInt32LE(42);

    // 读取
    const parser = new BinaryParser(writer.getBuffer());
    expect(parser.readString(4)).toBe("TEST");
    expect(parser.readBytes(4)).toEqual(testData);
    expect(parser.readUInt32LE()).toBe(42);
  });
});
