export interface ApiSuccessEnvelope<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ApiErrorEnvelope {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

/** HTTP 상태와 서버 오류 envelope를 함께 전달하는 요청 오류다. */
export interface ApiRequestError extends Error {
  status?: number;
  pathname?: string;
  code?: string;
  details?: unknown;
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const requestError = error as ApiRequestError;
  return requestError.status === 404 || requestError.code === "not_found";
}

export async function createResponseError(
  response: Response,
  pathname: string,
  method: string,
): Promise<Error> {
  const body = await readJsonBody(response);
  const envelope = isApiErrorEnvelope(body) ? body : undefined;
  const message = envelope?.error.message ?? `${method} ${pathname}: ${response.status}`;
  const error = new Error(message) as ApiRequestError;
  error.status = response.status;
  error.pathname = pathname;
  if (envelope) {
    error.code = envelope.error.code;
    error.details = envelope.error.details;
  }
  return error;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

export function unwrapApiEnvelope<T>(body: unknown): T {
  if (isApiSuccessEnvelope<T>(body)) return body.data;
  return body as T;
}

export function isApiSuccessEnvelope<T>(body: unknown): body is ApiSuccessEnvelope<T> {
  return isRecord(body) && body["ok"] === true && "data" in body;
}

export function isApiErrorEnvelope(body: unknown): body is ApiErrorEnvelope {
  return (
    isRecord(body) &&
    body["ok"] === false &&
    isRecord(body["error"]) &&
    typeof body["error"]["code"] === "string" &&
    typeof body["error"]["message"] === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
