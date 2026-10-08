/**
 * Shared fetch stubs for AI provider tests.
 *
 * These implement the `fetch` signature narrowly: they receive the URL and
 * init and return a Response-like object (never doing real I/O).
 */

/** Minimal async fetch replacement for injecting into providers. */
export type FetchMock = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Minimal Response stand-in with only what the provider consumes. */
function stubResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

/** 200 response carrying an arbitrary JSON body. */
export function jsonResponse(body: unknown): Response {
  return stubResponse(200, body);
}

/** Generic 200 OK with an empty case list. */
export function okResponse(): Response {
  return stubResponse(200, { choices: [{ message: { content: '{"cases":[]}' } }] });
}

/** Error response with a status code and message body. */
export function errorResponse(status: number, message: string): Response {
  return stubResponse(status, { error: { message } });
}
