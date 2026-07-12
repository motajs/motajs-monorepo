/**
 * 异步加载并挂载 script 标签到 body
 * @param src - script 的 src 属性
 * @param options - 可选配置
 * @returns Promise，在脚本加载完成时 resolve，失败时 reject
 */
export function loadScript(
  src: string,
  options?: {
    async?: boolean;
    defer?: boolean;
    type?: string;
    id?: string;
    crossOrigin?: string;
    integrity?: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载过该脚本
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;

    // 设置可选属性
    if (options?.async !== undefined) {
      script.async = options.async;
    }

    if (options?.defer) {
      script.defer = options.defer;
    }

    if (options?.type) {
      script.type = options.type;
    }

    if (options?.id) {
      script.id = options.id;
    }

    if (options?.crossOrigin) {
      script.crossOrigin = options.crossOrigin;
    }

    if (options?.integrity) {
      script.integrity = options.integrity;
    }

    // 加载成功
    script.onload = () => {
      resolve();
    };

    // 加载失败
    script.onerror = (error) => {
      reject(new Error(`Failed to load script: ${src}`, { cause: error }));
    };

    // 挂载到 body
    document.body.appendChild(script);
  });
}
