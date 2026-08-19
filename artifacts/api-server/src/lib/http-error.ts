export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "HttpError";
    this.status = status;
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    return new HttpError(500, "Internal server error", { cause: error });
  }

  return new HttpError(500, "Internal server error", {
    cause: new Error(String(error)),
  });
}
