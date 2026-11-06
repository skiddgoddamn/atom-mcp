import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function fakeBackend() {
  const seen = [];
  const tools = [{ name: "list_companies", description: "x", inputSchema: { type: "object", properties: {} } }];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      if (req.headers.authorization !== "Bearer atm_good") {
        res.writeHead(401).end("no");
        return;
      }
      const { id, method, params } = JSON.parse(body);
      const out = (result) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      if (method === "tools/list") return out({ tools });
      if (method === "tools/call") return out({ content: [{ type: "text", text: JSON.stringify({ called: params.name, args: params.arguments }) }] });
      out({});
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, seen, tools, port: server.address().port })));
}

async function connect(port, token, extraEnv = {}, client0) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    env: { ...process.env, ATOM_MCP_NO_UPDATE_CHECK: "1", ...extraEnv, ATOM_MCP_TOKEN: token, ATOM_BASE_URL: `http://127.0.0.1:${port}` },
    stderr: "pipe",
  });
  const client = client0 ?? new Client({ name: "test", version: "0" });
  await client.connect(transport);
  return client;
}

test("tools come from the server, not from the package", async () => {
  const b = await fakeBackend();
  const client = await connect(b.port, "atm_good");
  try {
    const first = await client.listTools();
    assert.deepEqual(first.tools.map((t) => t.name), ["list_companies"]);
    // server adds a tool: the proxy shows it with no change on the client side
    b.tools.push({ name: "brand_new_tool", description: "y", inputSchema: { type: "object", properties: {} } });
    const second = await client.listTools();
    assert.deepEqual(second.tools.map((t) => t.name), ["list_companies", "brand_new_tool"]);
    assert.equal(b.seen[0].url, "/api/mcp");
    assert.equal(b.seen[0].auth, "Bearer atm_good");
  } finally {
    await client.close();
    b.server.close();
  }
});

test("tools/call is forwarded with arguments", async () => {
  const b = await fakeBackend();
  const client = await connect(b.port, "atm_good");
  try {
    const r = await client.callTool({ name: "list_tasks", arguments: { companyId: "c1" } });
    assert.match(r.content[0].text, /"called":"list_tasks"/);
    assert.match(r.content[0].text, /"companyId":"c1"/);
  } finally {
    await client.close();
    b.server.close();
  }
});

test("a rejected token surfaces as a readable tool error", async () => {
  const b = await fakeBackend();
  const client = await connect(b.port, "atm_wrong");
  try {
    const r = await client.callTool({ name: "list_companies", arguments: {} });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Token rejected/);
  } finally {
    await client.close();
    b.server.close();
  }
});

test("refuses to start without a valid token", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["dist/index.js"], { env: { PATH: process.env.PATH }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ATOM_MCP_TOKEN/);
});

test("server declares listChanged and a catalog change triggers the notification", async () => {
  const { ToolListChangedNotificationSchema } = await import("@modelcontextprotocol/sdk/types.js");
  const b = await fakeBackend();
  const client = new Client({ name: "test", version: "0" });
  let notified = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, async () => { notified++; });
  await connect(b.port, "atm_good", { ATOM_TOOLS_REFRESH_MS: "200" }, client);
  try {
    assert.equal(client.getServerCapabilities().tools.listChanged, true);
    await client.listTools();
    b.tools.push({ name: "brand_new_tool", description: "y", inputSchema: { type: "object", properties: {} } });
    for (let i = 0; i < 40 && !notified; i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(notified >= 1);
  } finally { await client.close(); b.server.close(); }
});

test("new package version: instructions and first tool result only", async () => {
  const b = await fakeBackend();
  const reg = http.createServer((_, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ version: "99.0.0" })));
  await new Promise((r) => reg.listen(0, "127.0.0.1", r));
  const cache = join(mkdtempSync(join(tmpdir(), "upd-")), "x");
  // cache lives in os tmpdir under a fixed name; force a fresh query by pointing TMPDIR elsewhere
  const env = { ATOM_MCP_NO_UPDATE_CHECK: "", ATOM_NPM_REGISTRY_URL: `http://127.0.0.1:${reg.address().port}/`, TMP: cache, TEMP: cache, TMPDIR: cache };
  const { mkdirSync } = await import("node:fs");
  mkdirSync(cache, { recursive: true });
  const client = await connect(b.port, "atm_good", env);
  try {
    assert.match(client.getInstructions(), /Доступна новая версия @getatom\/mcp 99\.0\.0/);
    const r1 = await client.callTool({ name: "x", arguments: {} });
    assert.match(r1.content.at(-1).text, /npx -y @getatom\/mcp@latest/);
    const r2 = await client.callTool({ name: "x", arguments: {} });
    assert.equal(r2.content.length, 1);
  } finally { await client.close(); b.server.close(); reg.close(); }
});
