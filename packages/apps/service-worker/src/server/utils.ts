export class ResponseUtils {
  static text(text: string, response?: ResponseInit) {
    return new Response(text, response);
  }

  static blob(blob: Blob, response?: ResponseInit) {
    return new Response(blob, response);
  }

  static answer(code: number, message: string, data: unknown) {
    return Response.json({
      code,
      data,
      message,
    });
  }

  static create404() {
    return new Response("404 not found", {
      status: 404,
      statusText: "Not found",
    });
  }

  static error(status: number, code: string, message: string, path?: string) {
    return Response.json({ error: { code, message, ...(path ? { path } : {}) } }, {
      status,
      headers: { "cache-control": "no-store" },
    });
  }

  static create500(reason = "500 Internal Server Error") {
    return new Response(reason, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly path?: string,
  ) {
    super(message);
  }
}

export const isNotFoundError = (error: unknown): boolean => {
  const candidate = error as { name?: string; code?: string; message?: string };
  return candidate?.name === "NotFoundError"
    || candidate?.code === "ENOENT"
    || (
      candidate?.code === "ERR_INVALID_ARG_VALUE"
      && candidate?.message === "Unable to open file as blob"
    );
};

export const errorResponse = (error: unknown, path?: string) => {
  if (error instanceof HttpError) {
    return ResponseUtils.error(error.status, error.code, error.message, error.path);
  }
  const candidate = error as { name?: string; code?: string; message?: string };
  if (candidate?.name === "NotAllowedError" || candidate?.code === "EACCES") {
    return ResponseUtils.error(403, "project-permission-required", "Project permission is required", path);
  }
  if (isNotFoundError(error)) {
    return ResponseUtils.error(404, "file-not-found", candidate.message ?? "File not found", path);
  }
  return ResponseUtils.error(500, "internal-error", candidate?.message ?? String(error), path);
};
