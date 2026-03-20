type JsonValue = unknown;

type MockResponseInit = {
  ok?: boolean;
  status?: number;
  json?: JsonValue;
};

export function createJsonResponse(init: MockResponseInit = {}) {
  const status = init.status ?? (init.ok === false ? 500 : 200);
  const ok = init.ok ?? (status >= 200 && status < 300);
  const jsonBody = init.json ?? {};

  return {
    ok,
    status,
    async json() {
      return jsonBody;
    },
  } as Response;
}

export function installFetchMock(
  handler: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Response | Promise<Response>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
    handler(input, init)) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

