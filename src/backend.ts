// Minimal JSON-RPC client for the cabinet's Streamable HTTP MCP endpoint (stateless, POST only).

export interface BackendConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export class BackendError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "BackendError";
  }
}

let nextId = 1;

export async function rpc<T>(cfg: BackendConfig, method: string, params?: unknown): Promise<T> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.token}`,
      "User-Agent": "atom-mcp",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params: params ?? {} }),
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 60_000),
  });
  if (res.status === 401) {
    throw new BackendError(401, "Token rejected (invalid, expired or revoked). Create a new one in the cabinet: Pulse, Settings, MCP.");
  }
  if (res.status === 429) {
    throw new BackendError(429, "Rate limit reached, retry in a minute.");
  }
  const text = await res.text();
  if (!res.ok) {
    throw new BackendError(res.status, `Server answered ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const body = JSON.parse(text) as { result?: T; error?: { code: number; message: string } };
  if (body.error) throw new BackendError(400, body.error.message);
  return body.result as T;
}
