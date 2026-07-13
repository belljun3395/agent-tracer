export interface ErrorReport {
  readonly error: Error;
  readonly componentStack?: string;
}

export function reportError({ error, componentStack }: ErrorReport): void {
  console.error("[error]", error, componentStack ?? "");
}
