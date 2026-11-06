// Detects changes of the server tool catalog so the client can be told via tools/list_changed.

import { createHash } from "node:crypto";

export interface ToolDef { name: string; [k: string]: unknown }

export function catalogHash(tools: ToolDef[]): string {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export function diffCatalog(before: ToolDef[], after: ToolDef[]) {
  const b = new Map(before.map((t) => [t.name, JSON.stringify(t)]));
  const a = new Map(after.map((t) => [t.name, JSON.stringify(t)]));
  return {
    added: [...a.keys()].filter((n) => !b.has(n)),
    removed: [...b.keys()].filter((n) => !a.has(n)),
    changed: [...a.keys()].filter((n) => b.has(n) && b.get(n) !== a.get(n)),
  };
}

export function hasChanges(d: ReturnType<typeof diffCatalog>): boolean {
  return d.added.length + d.removed.length + d.changed.length > 0;
}
