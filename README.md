# @getatom/mcp

MCP server for the entrepreneur cabinet at [getatom.ru](https://getatom.ru). It lets agents such as Claude Code, Codex and Cursor configure and use the cabinet:

- **Pulse**: companies, integrations (amoCRM, Bitrix24, ad accounts), settings, dashboard metrics, losses, deals
- **Tasks and projects**: boards, columns, tasks, comments
- **Task reminders and digest**: `get_task_digest` (my tasks for today, tomorrow or the week, like the /today /tomorrow /week bot commands), `get_my_reminder_settings`, `update_my_reminder_settings`, `reset_my_reminder_settings` (personal offsets in minutes, 08:00 task digest, quiet hours, channels: cabinet, Telegram, email, overdue notice, time zone). Defaults: 30 and 10 minutes before the deadline and a digest at 08:00. Plain-words tasks with a deadline and a repeat go through the cabinet chat (`propose_task`, `recurrence_text`).
- **Reports** and their Telegram chats: targets, link codes, subscriptions, previews, runs, report rules
- **OKK** (sales quality control): summary, findings, forgotten deals, deal review
- **Team**: members, roles, groups, permissions, invites
- **Chats and messages**: threads, history, search, send
- **Navigation**: company menu rules and personal menu
- **Profile and communities**: `get_my_profile`, `update_my_profile`, `list_my_groups` (communities where you are admin), group admin tools (`group_*`)
- **Marketplace**: `create_marketplace_listing`, `update_marketplace_listing`, `pause_marketplace_listing`, `activate_marketplace_listing`, `delete_marketplace_listing`, `respond_to_marketplace_listing`, `list_marketplace_responses`
- **Partner program**: `get_partner_overview`, `list_partner_referrals`, `list_partner_accruals` and partner links with stats (`partner_list_links`, `partner_create_link`, `partner_update_link`, `partner_delete_link`, `partner_link_stats`). Withdrawals are deliberately not available over MCP.

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
claude mcp add atom --scope user --env ATOM_MCP_TOKEN=atm_YOUR_TOKEN -- npx -y @getatom/mcp@latest
```

```json
{ "mcpServers": { "atom": { "command": "npx", "args": ["-y", "@getatom/mcp@latest"], "env": { "ATOM_MCP_TOKEN": "atm_YOUR_TOKEN" } } } }
```

| Variable | Default | |
| --- | --- | --- |
| `ATOM_MCP_TOKEN` | required | token from the cabinet |
| `ATOM_BASE_URL` | `https://getatom.ru` | override for tests |

## Updates

- **Tools update themselves.** The package holds no tool list. It re-reads the catalog from the server every 10 minutes (override: `ATOM_TOOLS_REFRESH_MS`) and, when it changed, sends `notifications/tools/list_changed`, so Claude Code, Claude Desktop and others pick up new tools without a restart.
- **Package version check.** On start, at most once per 24 hours (cached in the OS temp dir), the package asks `registry.npmjs.org` for the latest version (3 s timeout, silent offline). If a newer one exists, it writes a line to stderr, adds it to the server instructions and appends a short notice to the first tool result of the session. It never installs anything by itself. Disable with `ATOM_MCP_NO_UPDATE_CHECK=1`.
- **Always the newest package.** Use `npx -y @getatom/mcp@latest` as in the configs above: every launch then takes the current version.

## Что нового

- **1.2.0**: профиль и сообщества (`get_my_profile`, `update_my_profile`, `list_my_groups`, `group_*`), маркетплейс (создание, правка, пауза, удаление объявлений, отклики), партнерка (обзор, рефералы, начисления, партнерские ссылки и их статистика). Вывод средств через MCP недоступен намеренно. В чате внутри кабинета все инструменты записи выполняются через карточку подтверждения.
- **1.1.0**: инструменты обновляются на лету (`list_changed`, опрос раз в 10 минут), проверка новой версии пакета раз в сутки, конфиг с `@latest`.
- **1.0.0**: первый выпуск, stdio-прокси к MCP getatom.ru.

## First prompt

> Connect the atom MCP server, call `list_companies` and show my companies and permissions. Describe every change and wait for my approval before making it.

## Limits and safety

- 120 calls per minute per token, 30 per minute for non-read calls.
- Every call is audited on the server (tool, company, result; arguments are not stored).
- A token reaches only the tool registry, never the rest of the API, and cannot create or revoke tokens.
- In the in-cabinet chat, write tools go through a confirm card: the action runs only after you press confirm.
- Keep tokens out of git. Revoke one that leaked.

## Development

```bash
npm install
npm test     # builds and runs the proxy tests against a fake server
```

Source: https://github.com/skiddgoddamn/atom-mcp

MIT license.
