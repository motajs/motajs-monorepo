// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { probeAudioSource } from '../audioOpus';

// 源音频探测用例：用 Node 的 Blob 稳定解析合成 WAV，钉住「读到真的采样率」与「坏字节 / 空字节静默返回读不到」。

/**
 * 把 ASCII 文本写进字节数组
 * @param bytes 目标字节数组
 * @param offset 起始偏移
 * @param text 要写入的 ASCII 文本
 */
function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}

/**
 * 合成 16 位单声道 WAV 字节
 * @param sampleRate 采样率（Hz）
 * @param sampleCount 采样点数量
 * @returns 完整的 RIFF / WAVE 字节
 */
function createWav(sampleRate: number, sampleCount: number): Uint8Array {
  const bytes = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(bytes.buffer);

  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 12000);
    view.setInt16(44 + index * 2, sample, true);
  }

  return bytes;
}

describe('源音频参数探测', () => {
  // 能解出合成 WAV 自己的采样率
  it('读出 WAV 的 16000 Hz 采样率', async () => {
    const info = await probeAudioSource(createWav(16000, 1600));

    expect(info?.sampleRate).toBe(16000);
  });

  // 无效字节解析失败时静默返回「读不到」
  it('无效字节返回 undefined', async () => {
    await expect(probeAudioSource(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
  });

  // 空字节没有可解析的容器，同样返回「读不到」
  it('空字节返回 undefined', async () => {
    await expect(probeAudioSource(new Uint8Array(0))).resolves.toBeUndefined();
  });
});
