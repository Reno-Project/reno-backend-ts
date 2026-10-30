export function errorDetails(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as { original?: unknown; parent?: unknown }).original
      ?? (e as { parent?: unknown }).parent;

    if (cause instanceof Error && cause.message && cause.message !== e.message) {
      return `${e.message} | ${cause.message}`;
    }

    return e.message;
  }

  if (typeof e === "string") {
    return e;
  }

  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}
