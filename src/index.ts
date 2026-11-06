#!/usr/bin/env node
// atom-mcp: stdio proxy to the getatom.ru cabinet MCP endpoint.
// It holds NO tool definitions: tools/list and tools/call are forwarded to the server, so new
// capabilities appear for every user without a new npm release.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { BackendError, rpc, type BackendConfig } from "./backend.js";
import { diffCatalog, hasChanges, type ToolDef } from "./catalog.js";
import { checkForUpdate, updateNotice } from "./update.js";

const VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
const REFRESH_MS = Number(process.env.ATOM_TOOLS_REFRESH_MS) || 10 * 60 * 1000;

const token = process.env.ATOM_MCP_TOKEN?.trim();
if (!token || !token.startsWith("atm_")) {
  console.error("ATOM_MCP_TOKEN is missing or malformed. Create a token in the cabinet (Pulse, Settings, MCP); it starts with atm_.");
  process.exit(1);
}
const cfg: BackendConfig = { baseUrl: process.env.ATOM_BASE_URL?.trim() || "https://getatom.ru", token };

// Version check (cached 24 h, 3 s timeout, silent offline). Notifies only; never installs. Logs go to stderr.
const latest = process.env.ATOM_MCP_NO_UPDATE_CHECK
  ? null
  : await checkForUpdate({ current: VERSION, registryUrl: process.env.ATOM_NPM_REGISTRY_URL?.trim() || undefined });
const notice = latest ? updateNotice(latest) : null;
if (notice) console.error(`[@getatom/mcp] ${notice}`);
let noticePending = notice;

const server = new Server(
  { name: "@getatom/mcp", version: VERSION },
  {
    capabilities: { tools: { listChanged: true } },
    instructions:
      "Cabinet of the getatom.ru entrepreneur. Call list_companies first: companyId is required by most tools. Permissions are enforced by the server for the token owner."
      + (notice ? ` ${notice}. Tell the user once.` : ""),
  },
);

let known: ToolDef[] | null = null;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const r = await rpc<{ tools: ToolDef[] }>(cfg, "tools/list");
  known = r.tools;
  return { tools: r.tools } as never;
});

// Periodically re-read the catalog; tell the client when it changed so it refreshes without a restart.
async function refreshTools() {
  try {
    const r = await rpc<{ tools: ToolDef[] }>(cfg, "tools/list");
    const prev = known;
    known = r.tools;
    if (prev && hasChanges(diffCatalog(prev, r.tools))) await server.sendToolListChanged();
  } catch { /* offline or token problem: try next time */ }
}
setInterval(refreshTools, REFRESH_MS).unref();
server.oninitialized = () => { void refreshTools(); };

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const r = await rpc<unknown>(cfg, "tools/call", { name: req.params.name, arguments: req.params.arguments ?? {} });
    if (noticePending) {
      const res = r as { content?: unknown[] };
      if (Array.isArray(res?.content)) res.content.push({ type: "text", text: noticePending });
      noticePending = null;
    }
    return r as never;
  } catch (e) {
    const msg = e instanceof BackendError ? e.message : `Request failed: ${(e as Error).message}`;
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
});

await server.connect(new StdioServerTransport());
