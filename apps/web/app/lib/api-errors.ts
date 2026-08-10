// Thin plumbing shared by app/api/* route handlers — HTTP status mapping
// only, never domain logic (.claude/rules/web-routes.md). packages/core
// functions throw a plain Error for "referenced row not found", following
// the "functionName: no <table> row <id>" message convention set in
// registration.ts/waitlist.ts. Sniffing that substring is a stand-in for a
// typed NotFoundError — acceptable for now because each route below only
// ever calls core functions that follow this exact convention, so a false
// positive would require one of them to start throwing an unrelated error
// with that same shape, which nothing here does.
export function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && /: no \S+ row/.test(err.message);
}

export function internalErrorResponse(context: string, err: unknown): Response {
  console.error(`[${context}]`, err);
  return Response.json({ error: "internal error" }, { status: 500 });
}
