import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions, checkForUpdate, DAY_MS } from "../dist/update.js";
import { diffCatalog, hasChanges, catalogHash } from "../dist/catalog.js";

function registry(version) {
  let hits = 0;
  const s = http.createServer((_, res) => { hits++; res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ version })); });
  return new Promise((r) => s.listen(0, "127.0.0.1", () => r({ s, hits: () => hits, url: `http://127.0.0.1:${s.address().port}/` })));
}
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "upd-")), "c.json");

test("compareVersions", () => {
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
  assert.ok(compareVersions("1.1.0", "1.1.0") === 0);
  assert.ok(compareVersions("1.0.0", "1.0.1") < 0);
  assert.ok(compareVersions("v2.0", "1.9.9") > 0);
});

test("newer version is reported and cached for 24h", async () => {
  const r = await registry("1.2.0");
  const cacheFile = tmpFile();
  try {
    assert.equal(await checkForUpdate({ current: "1.1.0", registryUrl: r.url, cacheFile, now: 1000 }), "1.2.0");
    assert.equal(await checkForUpdate({ current: "1.1.0", registryUrl: r.url, cacheFile, now: 1000 + DAY_MS - 1 }), "1.2.0");
    assert.equal(r.hits(), 1);
    await checkForUpdate({ current: "1.1.0", registryUrl: r.url, cacheFile, now: 1000 + DAY_MS });
    assert.equal(r.hits(), 2);
  } finally { r.s.close(); }
});

test("same or older registry version gives null", async () => {
  const r = await registry("1.1.0");
  try { assert.equal(await checkForUpdate({ current: "1.1.0", registryUrl: r.url, cacheFile: tmpFile() }), null); } finally { r.s.close(); }
});

test("offline, bad cache and bad response fail silently", async () => {
  const cacheFile = tmpFile();
  writeFileSync(cacheFile, "{broken");
  assert.equal(await checkForUpdate({ current: "1.1.0", registryUrl: "http://127.0.0.1:1/", cacheFile, timeoutMs: 500 }), null);
  const s = http.createServer((_, res) => res.writeHead(200).end("not json"));
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  try { assert.equal(await checkForUpdate({ current: "1.1.0", registryUrl: `http://127.0.0.1:${s.address().port}/`, cacheFile }), null); } finally { s.close(); }
  assert.equal(readFileSync(cacheFile, "utf8"), "{broken");
});

test("diffCatalog finds added, removed, changed; hash is order independent", () => {
  const a = [{ name: "a", description: "1" }, { name: "b", description: "1" }];
  const b = [{ name: "b", description: "2" }, { name: "c", description: "1" }];
  assert.deepEqual(diffCatalog(a, b), { added: ["c"], removed: ["a"], changed: ["b"] });
  assert.equal(hasChanges(diffCatalog(a, [...a].reverse())), false);
  assert.equal(catalogHash(a), catalogHash([...a].reverse()));
  assert.notEqual(catalogHash(a), catalogHash(b));
});
