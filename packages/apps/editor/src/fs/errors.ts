interface ErrorWithCode extends Error {
  code?: string;
}

/**
 * Only classify errors that explicitly describe the requested file as missing.
 * In particular, service-worker errors such as `project-not-found` describe the
 * project handle/access state and must remain ordinary errors.
 */
export function isFileNotFoundError(error: Error): boolean {
  const { code } = error as ErrorWithCode;
  if (code) return code === "file-not-found" || code === "ENOENT";

  return error.name === "NotFoundError"
    || /\bfile-not-found\b/i.test(error.message)
    || /\bfile not found\b/i.test(error.message)
    || /\bENOENT\b/i.test(error.message)
    || /\bno such file\b/i.test(error.message);
}
