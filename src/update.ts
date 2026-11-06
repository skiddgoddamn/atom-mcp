// Package version check: once per 24 h (cached in the OS temp dir), 3 s timeout, silent offline.
// Never installs anything; only reports.

import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const REGISTRY_URL = "https://registry.npmjs.org/@getatom/mcp/latest";
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Compares dotted versions numerically (pre-release suffix ignored). Returns >0 if a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.trim().replace(/^v/, "").split("-")[0].split(".").map((p) => parseInt(p, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface CheckOptions {
  current: string;
  registryUrl?: string;
  cacheFile?: string;
  now?: number;
  timeoutMs?: number;
}

/** Returns the newer version string if one exists, otherwise null. Never throws. */
export async function checkForUpdate(o: CheckOptions): Promise<string | null> {
  const file = o.cacheFile ?? join(tmpdir(), "getatom-mcp-update-check.json");
  const now = o.now ?? Date.now();
  let latest: string | null = null;
  try {
    const c = JSON.parse(await readFile(file, "utf8")) as { checkedAt: number; latest: string };
    if (typeof c.latest === "string" && now - c.checkedAt >= 0 && now - c.checkedAt < DAY_MS) {
      latest = c.latest;
      return compareVersions(latest, o.current) > 0 ? latest : null;
    }
  } catch { /* no or broken cache: query */ }
  try {
    const res = await fetch(o.registryUrl ?? REGISTRY_URL, { signal: AbortSignal.timeout(o.timeoutMs ?? 3000), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const v = ((await res.json()) as { version?: unknown }).version;
    if (typeof v !== "string" || !/^\d+\.\d+\.\d+/.test(v)) return null;
    latest = v;
    await writeFile(file, JSON.stringify({ checkedAt: now, latest })).catch(() => {});
  } catch { return null; }
  return compareVersions(latest, o.current) > 0 ? latest : null;
}

export function updateNotice(latest: string): string {
  return `Доступна новая версия @getatom/mcp ${latest}. Обновите: npx -y @getatom/mcp@latest (или перезапустите MCP, если используется @latest)`;
}
