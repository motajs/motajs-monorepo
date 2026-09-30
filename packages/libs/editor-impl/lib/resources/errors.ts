interface ErrorWithCode extends Error {
  code?: string;
}

// 只把「明确描述了所请求文件缺失」的错误归类为文件缺失
// 特别是 service-worker 的 `project-not-found` 这类错误描述的是项目句柄/访问状态，必须保持为普通错误
export function isFileNotFoundError(error: Error): boolean {
  const { code } = error as ErrorWithCode;
  if (code) return code === 'file-not-found' || code === 'ENOENT';

  return (
    error.name === 'NotFoundError' ||
    /\bfile-not-found\b/i.test(error.message) ||
    /\bfile not found\b/i.test(error.message) ||
    /\bENOENT\b/i.test(error.message) ||
    /\bno such file\b/i.test(error.message)
  );
}
