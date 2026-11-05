# atom-mcp

MCP server for the entrepreneur cabinet at [getatom.ru](https://getatom.ru). It lets agents such as Claude Code, Codex and Cursor configure and use the cabinet:

- **Pulse**: companies, integrations (amoCRM, Bitrix24, ad accounts), settings, dashboard metrics, losses, deals
- **Tasks and projects**: boards, columns, tasks, comments
- **Reports** and their Telegram chats: targets, link codes, subscriptions, previews, runs, report rules
- **OKK** (sales quality control): summary, findings, forgotten deals, deal review
- **Team**: members, roles, groups, permissions, invites
- **Chats and messages**: threads, history, search, send
- **Navigation**: company menu rules and personal menu

Every call runs with the rights of the token owner. The server checks roles and permissions exactly as the web app does.

## Tools are live

This package contains **no tool list**. `tools/list` and `tools/call` are forwarded to `https://getatom.ru/api/mcp`, so a tool added to the cabinet shows up in your agent without updating the package. The in-cabinet AI chat reads the same registry.

## Get a token

Cabinet, Pulse, Settings, section **MCP**. Create a token, pick the access level, copy the secret (it starts with `atm_` and is shown once).

| Level | Allows |
| --- | --- |
| READ | reading only |
| WRITE | plus routine work: tasks, comments, messages, sync, menu |
| MANAGE | plus settings, roles, members, invites, integrations, deletions |

A token can be limited to one company and expires in 30, 90 or 365 days. Revoke it in the same section; the effect is immediate.

## Connect

The server speaks Streamable HTTP, so most clients need no install.

**Claude Code**

```bash
claude mcp add --transport http --scope user atom https://getatom.ru/api/mcp --header "Authorization: Bearer atm_YOUR_TOKEN"
```

**Codex** (`~/.codex/config.toml`)

```toml
[mcp_servers.atom]
url = "https://getatom.ru/api/mcp"
bearer_token_env_var = "ATOM_MCP_TOKEN"
```

and `export ATOM_MCP_TOKEN=atm_YOUR_TOKEN`.

**Cursor** (`~/.cursor/mcp.json`)

```json
{ "mcpServers": { "atom": { "url": "https://getatom.ru/api/mcp", "headers": { "Authorization": "Bearer atm_YOUR_TOKEN" } } } }
```

### Through this package (stdio)

For clients without HTTP support:

```bash
claude mcp add atom --scope user --env ATOM_MCP_TOKEN=atm_YOUR_TOKEN -- npx -y atom-mcp
```

```json
{ "mcpServers": { "atom": { "command": "npx", "args": ["-y", "atom-mcp"], "env": { "ATOM_MCP_TOKEN": "atm_YOUR_TOKEN" } } } }
```

| Variable | Default | |
| --- | --- | --- |
| `ATOM_MCP_TOKEN` | required | token from the cabinet |
| `ATOM_BASE_URL` | `https://getatom.ru` | override for tests |

## First prompt

> Connect the atom MCP server, call `list_companies` and show my companies and permissions. Describe every change and wait for my approval before making it.

## Limits and safety

- 120 calls per minute per token, 30 per minute for non-read calls.
- Every call is audited on the server (tool, company, result; arguments are not stored).
- A token reaches only the tool registry, never the rest of the API, and cannot create or revoke tokens.
- Keep tokens out of git. Revoke one that leaked.

## Development

```bash
npm install
npm test     # builds and runs the proxy tests against a fake server
```

MIT license.
