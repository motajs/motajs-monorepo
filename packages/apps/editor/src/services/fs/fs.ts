/**
 * fs 模块 - 文件系统操作
 *
 * 提供文件系统操作的两种 API 风格：
 * - 回调风格 API（兼容原有代码）
 * - Promise 风格 API（fs.promises 命名空间）
 */

import { editorEndpoint } from '@/environment';

// ==================== 类型定义 ====================

/** 文件编码类型 */
export type FileEncoding = 'utf-8' | 'base64';

/** 标准回调函数类型 */
export type Callback<T = string> = (err: string | null, data?: T | null) => void;

/** 无返回值回调函数类型 */
export type VoidCallback = (err: string | null) => void;

/** fs.promises 模块接口 */
export interface FsPromiseApi {
  readFile(filename: string, encoding: FileEncoding): Promise<string>;
  readFileBinary(filename: string): Promise<ArrayBuffer>;
  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void>;
  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

/** 完整的 fs 模块接口 */
export interface Fs {
  readFile(filename: string, encoding: FileEncoding, callback: Callback<string>): void;
  writeFile(filename: string, data: string, encoding: FileEncoding, callback: VoidCallback): void;
  writeMultiFiles(filenames: string[], dataList: string[], callback: VoidCallback): void;
  readdir(path: string, callback: Callback<string[]>): void;
  mkdir(path: string, callback: VoidCallback): void;
  moveFile(src: string, dest: string, callback: VoidCallback): void;
  deleteFile(path: string, callback: VoidCallback): void;
  promises: FsPromiseApi;
}

// ==================== 工具函数 ====================

/**
 * base64 转 ArrayBuffer（兼容浏览器与 Node 环境）
 */
function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  const nodeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (!nodeBuffer) {
    throw new Error('Base64 decode not supported in this environment.');
  }

  const buffer = nodeBuffer.from(base64, 'base64');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

/**
 * 发送 HTTP 请求（fetch）
 */
async function httpRequest(type: string, url: string, formData: string | null): Promise<string> {
  try {
    const response = await fetch(url, {
      method: type,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: formData ?? undefined,
    });

    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText;
      try {
        const payload = JSON.parse(responseText) as { error?: { code?: string; message?: string; path?: string } };
        const error = payload.error;
        if (error) detail = [error.code, error.message, error.path].filter(Boolean).join(': ');
      } catch {
        // Preserve non-JSON server errors as text.
      }
      const requestPath = new URLSearchParams(formData ?? '').get('name');
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}${requestPath ? ` [${requestPath}]` : ''}`);
    }

    return responseText;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${message}：请检查启动服务是否处于正常运行状态。`);
  }
}

/**
 * 向服务器发送 POST 请求并处理响应
 */
function postData(data: string | null, endpoint: string, callback: Callback): void {
  if (typeof data === 'undefined' || data === null) {
    data = JSON.stringify({ 1: 2 });
  }

  httpRequest('POST', editorEndpoint('fs', endpoint), data)
    .then((response) => {
      if (response.slice(0, 6) === 'error:') {
        callback(response, null);
      } else {
        callback(null, response);
      }
    })
    .catch((err: Error) => {
      if ((window as unknown as { main: unknown }).main != null) {
        console.log(err.message);
      } else {
        console.log(err.message);
      }
      callback(err.message);
    });
}

// ==================== Promise API ====================

/**
 * 将回调函数转换为 Promise
 */
function promisify<T>(fn: (callback: Callback<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) {
        reject(new Error(err));
      } else {
        resolve(data as T);
      }
    });
  });
}

const promises: FsPromiseApi = {
  readFile(filename: string, encoding: FileEncoding): Promise<string> {
    return promisify<string>((callback) => {
      fs.readFile(filename, encoding, callback);
    });
  },

  readFileBinary(filename: string): Promise<ArrayBuffer> {
    return promisify<string>((callback) => {
      fs.readFile(filename, 'base64', callback);
    }).then((base64) => decodeBase64ToArrayBuffer(base64));
  },

  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void> {
    return promisify<void>((callback) => {
      fs.writeFile(filename, data, encoding, callback as VoidCallback);
    });
  },

  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void> {
    return promisify<void>((callback) => {
      fs.writeMultiFiles(filenames, dataList, callback as VoidCallback);
    });
  },

  readdir(path: string): Promise<string[]> {
    return promisify<string[]>((callback) => {
      fs.readdir(path, callback);
    });
  },

  mkdir(path: string): Promise<void> {
    return promisify<void>((callback) => {
      fs.mkdir(path, callback as VoidCallback);
    });
  },

  moveFile(src: string, dest: string): Promise<void> {
    return promisify<void>((callback) => {
      fs.moveFile(src, dest, callback as VoidCallback);
    });
  },

  deleteFile(path: string): Promise<void> {
    return promisify<void>((callback) => {
      fs.deleteFile(path, callback as VoidCallback);
    });
  },
};

// ==================== 回调 API ====================

export const fs: Fs = {
  readFile(filename: string, encoding: FileEncoding, callback: Callback<string>): void {
    if (typeof filename !== 'string') {
      throw 'Type Error in fs.readFile';
    }
    if (encoding === 'utf-8') {
      const params = new URLSearchParams();
      params.set('type', 'utf8');
      params.set('name', filename);
      postData(params.toString(), 'readFile', callback);
      return;
    }
    if (encoding === 'base64') {
      const params = new URLSearchParams();
      params.set('type', 'base64');
      params.set('name', filename);
      postData(params.toString(), 'readFile', callback);
      return;
    }
    throw 'Type Error in fs.readFile';
  },

  writeFile(filename: string, datastr: string, encoding: FileEncoding, callback: VoidCallback): void {
    if (typeof filename !== 'string' || typeof datastr !== 'string') {
      throw 'Type Error in fs.writeFile';
    }
    if (encoding === 'utf-8') {
      const params = new URLSearchParams();
      params.set('type', 'utf8');
      params.set('name', filename);
      params.set('value', datastr);
      postData(params.toString(), 'writeFile', callback);
      return;
    }
    if (encoding === 'base64') {
      const params = new URLSearchParams();
      params.set('type', 'base64');
      params.set('name', filename);
      params.set('value', datastr);
      postData(params.toString(), 'writeFile', callback);
      return;
    }
    throw 'Type Error in fs.writeFile';
  },

  writeMultiFiles(filenames: string[], datastrs: string[], callback: VoidCallback): void {
    const params = new URLSearchParams();
    params.set('name', filenames.join(';'));
    params.set('value', datastrs.join(';'));
    postData(params.toString(), 'writeMultiFiles', callback);
  },

  readdir(path: string, callback: Callback<string[]>): void {
    if (typeof path !== 'string') {
      throw 'Type Error in fs.readdir';
    }
    const params = new URLSearchParams();
    params.set('name', path);
    postData(params.toString(), 'listFile', (err, response) => {
      let parsedData: string[] | null = null;
      try {
        parsedData = JSON.parse(response as string);
      } catch {
        err = 'Invalid /listFile';
        parsedData = null;
      }
      callback(err, parsedData);
    });
  },

  mkdir(path: string, callback: VoidCallback): void {
    if (typeof path !== 'string') {
      throw 'Type Error in fs.readdir';
    }
    const params = new URLSearchParams();
    params.set('name', path);
    postData(params.toString(), 'makeDir', callback);
  },

  moveFile(src: string, dest: string, callback: VoidCallback): void {
    if (typeof src !== 'string' || typeof dest !== 'string') {
      throw 'Type Error in fs.readdir';
    }
    const params = new URLSearchParams();
    params.set('src', src);
    params.set('dest', dest);
    postData(params.toString(), 'moveFile', callback);
  },

  deleteFile(path: string, callback: VoidCallback): void {
    if (typeof path !== 'string') {
      throw 'Type Error in fs.readdir';
    }
    const params = new URLSearchParams();
    params.set('name', path);
    postData(params.toString(), 'deleteFile', callback);
  },

  promises,
};

export default fs;
