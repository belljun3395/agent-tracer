import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = (error as { status?: unknown; statusCode?: unknown }).statusCode
      ?? (error as { status?: unknown; statusCode?: unknown }).status;
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate < 600) {
      return candidate;
    }
  }

  return 500;
}

export const createErrorHandler = (): ErrorRequestHandler => {
  return (error, _req, res, _next) => {
    void _req; void _next;
    const status = getErrorStatus(error);
    res.status(status).json({ error: error instanceof Error ? error.message : "Unknown error" });
  };
};
