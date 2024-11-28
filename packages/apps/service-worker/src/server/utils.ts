export class ResponseUtils {
  static text(text: string, response?: ResponseInit) {
    return new Response(text, response);
  }

  static buffer(buffer: Buffer, response?: ResponseInit) {
    return new Response(buffer, response);
  }

  static answer(code: number, message: string, data: any) {
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

  static create500(reason = "500 Internal Server Error") {
    return new Response(reason, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}
