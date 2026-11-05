import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
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

async function connect(port, token) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    env: { ...process.env, ATOM_MCP_TOKEN: token, ATOM_BASE_URL: `http://127.0.0.1:${port}` },
    stderr: "pipe",
  });
  const client = new Client({ name: "test", version: "0" });
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
