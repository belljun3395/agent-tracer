import { request, type RequestOptions } from "~web/shared/api/client/request.js";
import { createResponseError, unwrapApiEnvelope } from "~web/shared/api/client/response.js";

export async function getJson<T>(pathname: string, options?: RequestOptions): Promise<T> {
  const response = await request(pathname, undefined, options);
  if (!response.ok) {
    throw await createResponseError(response, pathname, "GET");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

export async function deleteRequest<T>(
  pathname: string,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(pathname, { method: "DELETE" }, options);
  if (!response.ok) {
    throw await createResponseError(response, pathname, "DELETE");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

export async function postJson<T>(
  pathname: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "POST",
      headers: body !== undefined ? { "content-type": "application/json" } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "POST");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

export async function patchJson<T>(
  pathname: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "PATCH");
  }
  return unwrapApiEnvelope<T>(await response.json());
}

export async function patchPut<T>(
  pathname: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  const response = await request(
    pathname,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!response.ok) {
    throw await createResponseError(response, pathname, "PUT");
  }
  return unwrapApiEnvelope<T>(await response.json());
}
