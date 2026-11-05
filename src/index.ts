#!/usr/bin/env node
// atom-mcp: stdio proxy to the getatom.ru cabinet MCP endpoint.
// It holds NO tool definitions: tools/list and tools/call are forwarded to the server, so new
// capabilities appear for every user without a new npm release.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { BackendError, rpc, type BackendConfig } from "./backend.js";

const token = process.env.ATOM_MCP_TOKEN?.trim();
if (!token || !token.startsWith("atm_")) {
  console.error("ATOM_MCP_TOKEN is missing or malformed. Create a token in the cabinet (Pulse, Settings, MCP); it starts with atm_.");
  process.exit(1);
}
const cfg: BackendConfig = { baseUrl: process.env.ATOM_BASE_URL?.trim() || "https://getatom.ru", token };

const server = new Server(
  { name: "atom-mcp", version: "1.0.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Cabinet of the getatom.ru entrepreneur. Call list_companies first: companyId is required by most tools. Permissions are enforced by the server for the token owner.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const r = await rpc<{ tools: unknown[] }>(cfg, "tools/list");
  return { tools: r.tools } as never;
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const r = await rpc<unknown>(cfg, "tools/call", { name: req.params.name, arguments: req.params.arguments ?? {} });
    return r as never;
  } catch (e) {
    const msg = e instanceof BackendError ? e.message : `Request failed: ${(e as Error).message}`;
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
});

await server.connect(new StdioServerTransport());
