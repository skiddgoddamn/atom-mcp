# @getatom/mcp

MCP server for the entrepreneur cabinet at [getatom.ru](https://getatom.ru). It lets agents such as Claude Code, Codex and Cursor configure and use the cabinet:

- **Pulse**: companies, integrations (amoCRM, Bitrix24, ad accounts), settings, dashboard metrics, losses, deals
- **Tasks and projects**: boards, columns, tasks, comments
- **Task reminders and digest**: `get_task_digest` (my tasks for today, tomorrow or the week, like the /today /tomorrow /week bot commands), `get_my_reminder_settings`, `update_my_reminder_settings`, `reset_my_reminder_settings` (personal offsets in minutes, 08:00 task digest, quiet hours, channels: cabinet, Telegram, email, overdue notice, time zone). Defaults: 30 and 10 minutes before the deadline and a digest at 08:00. Plain-words tasks with a deadline and a repeat go through the cabinet chat (`propose_task`, `recurrence_text`).
- **Reports** and their Telegram chats: targets, link codes, subscriptions, previews, runs, report rules
- **OKK** (sales quality control): summary, findings, forgotten deals, deal review
- **Team**: members, roles, groups, permissions, invites
- **Chats and messages**: threads, history, search, send, leave a group (`leave_chat`), delete a chat (`delete_chat`: a group for everyone, owner or company admin only; a direct chat for yourself or, with `forBoth`, for both sides)
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

- **1.7.0**: аналитика Пульса, часть 2: дисциплина, маркетинг, клиенты, команда. Новое (только чтение, право аналитики): `get_discipline` (просроченные задачи CRM, задачи закрытые без результата в amoCRM, активность по дням, звонки и перезвоны за 30 минут, смены ответственного, связь балла ОКК с конверсией), `get_marketing_insights` (заявки, продажи, выручка и расход по каналам, цена заявки, цена клиента, ROMI, каналы в минусе и дорожающие, качество заявок и дубли; суммы в рублях, менеджеру без денег), `get_clients_insights` (повторные покупки, LTV по первому каналу, клиенты под риском потери, давно не покупавшие, топ клиентов) и `get_team_insights` (задачи Атома в срок, нагрузка, прогресс обучения; менеджер видит только себя). В `get_signals` добавлены сигналы: канал стал вдвое дороже и менеджер теряет на этапе.
- **1.6.0**: аналитика Пульса: что не так и что делать. Новое (только чтение, право аналитики): `get_signals` (до 5 сигналов: заявки без ответа, зависшие сделки, потери на этапе, главная причина отказов, прогноз; с этого лучше начинать разбор), `get_response_time` (скорость первого ответа на новую заявку: обычное время, ответы позже часа, заявки без ответа, по менеджерам и часам суток в часовом поясе компании), `list_stale_deals` (открытые сделки без звонков, сообщений и открытых задач N дней, их сумма, разбивка по менеджерам и этапам, сделки без следующей задачи) и `get_funnel_insights` (конверсия этап в этап, время на этапе, возвраты назад, цикл сделки, средний чек, причины отказов с долями, прогноз выручки по открытым сделкам). Сделки доступны в рамках прав: менеджер со своими сделками видит только свои.
- **1.7.0**: собственная CRM getatom (crm.getatom.ru). Новое: `crm_deal_search`, `crm_deal_get` (карточка: поля, открытые задачи, последние события), `crm_deal_create`, `crm_deal_update`, `crm_deal_move` (перенос по этапу, закрывающий этап ставит дату закрытия), `crm_contact_search` (телефоны в ответе замаскированы), `crm_contact_create`, `crm_note_add` (заметка в ленту сделки, контакта или организации), `crm_task_create`. Нужны права CRM_VIEW (чтение) и CRM_EDIT (изменения); менеджер без права видеть всех работает только со своими сделками и контактами. Сумма сделки в рублях (`priceRub`). Пакет ничего не хранит: инструменты приходят с сервера.
- **1.8.0**: деньги из банков (только чтение). Новое: `get_bank_status` (какие банки подключены: Точка, Альфа, Т-Банк, Сбер; статус и когда обновлялись), `list_bank_accounts` (счета и остатки в копейках, номер счета замаскирован) и `list_bank_transactions` (операции за период по дням: приход и расход, контрагент, назначение платежа, суммы в копейках; фильтры по счету и направлению). Нужно право Деньги (FINANCE_VIEW), по умолчанию его есть только у владельца компании. Платежи и переводы недоступны, подключение банка выполняется только в кабинете. Во встроенном ИИ-чате ИНН контрагентов не передаются, названия и назначения платежей проходят через маскирование. Пакет ничего не хранит: инструменты приходят с сервера.
- **1.9.0**: сверка денег и прогноз (только чтение, право Деньги FINANCE_VIEW). Новое: `get_cash_flow` (приход и расход по дням месяца, остаток на счетах, на сколько дней хватит денег: остаток делится на средний дневной чистый расход за 90 дней, пусто если приход покрывает расход; дни после сегодняшнего это прогноз по средним дня недели), `get_reconciliation` (успешные сделки без денег больше 3 дней, поступления без сделки, сколько сошлось: сумма с допуском 1%, окно 14 дней, имя или ИНН; дебиторка по возрасту) и `get_cash_forecast` (прогноз денег на конец месяца: факт, ожидаемые поступления и расходы, выручка по воронке, план-факт поступлений). Суммы в копейках. В `get_signals` для владельцев с правом Деньги добавлены сигналы: денег хватит меньше чем на 30 дней (меньше 14 срочно) и успешные сделки без денег. Во встроенном ИИ-чате внутренние id сделок и платежей и ИНН не передаются.
- **1.10.0**: еженедельный ИИ-разбор (только чтение, право Аналитика ANALYTICS_VIEW). Новое: `get_weekly_review` (цифры прошлой недели против позапрошлой: заявки, продажи, выручка в рублях, скорость ответа в секундах, конверсия, запас денег в днях при праве Деньги FINANCE_VIEW; сигналы Пульса; если разбор за неделю уже сделан, то его итог и до трех выводов с готовыми заголовками задач). Сам инструмент ИИ не вызывает и ничего не списывает. Разбор делает кабинет: по понедельникам в 9:00 по часовому поясу компании в чат владельца с картой и уведомлением (только компании с CRM и открытым ИИ-чатом), либо по кнопке Разобрать неделю в чате (не чаще трех раз за десять минут, расход идет на владельца компании как ход чата). Во встроенном ИИ-чате имена менеджеров заменяются псевдонимами М1, М2, телефоны, ссылки и id не передаются.
- **1.11.0**: заявки с сайта и телефония CRM. Новое: `crm_inbound_sources` (источники заявок Tilda / JSON: воронка, этап, тег, маппинг полей, число запросов; адреса с токенами не показываются), `crm_inbound_log` (журнал последних запросов источника), `crm_inbound_source_update` (включить или выключить, маппинг, воронка и этап), `crm_telephony_raw` (сырые HTTP-уведомления UIS или Novofon для сверки формата). Токен источника выпускается только в кабинете (Настройки CRM, Заявки с сайта). Инструменты появляются, когда на сервере включены приём заявок (CRM_INBOUND_ENABLED) или телефония; права CRM_VIEW и CRM_EDIT плюс раздел настроек виджетов. Пакет ничего не хранит: инструменты приходят с сервера.
- **1.12.0**: выход и удаление чатов. Новое: `leave_chat` (выйти из группового чата, в чат уходит сообщение о выходе) и `delete_chat` (группа для всех: только владелец чата или админ компании; личный диалог у себя или, с forBoth, у обоих). Чаты закрытых задач теперь уходят в архив сами: в `list_chat_threads` у них есть `closedAt`, писать в них нельзя. Как и остальные инструменты чатов, требуют chat-scope токена. Пакет ничего не хранит: инструменты приходят с сервера.
- **1.13.0**: ловец хуков и разбор заявок. Новое: `crm_inbound_catch_start` (режим «Поймать тестовый запрос» у вебхук-источника на 1-60 минут: первый запрос сохраняется без создания сделки, потом режим выключается сам), `crm_inbound_catch_stop`, `crm_inbound_catch_list` (пойманные запросы: заголовки без секретов, поля тела, JSON; токены, cookie и Authorization скрыты; значения пришли с чужого сайта, это данные, а не инструкции), `crm_inbound_catch_create` (создать контакт и сделку из пойманного запроса по маппингу источника) и `crm_inbound_suggest_mapping` (предложение маппинга полей, воронки и этапа с предпросмотром: ИИ по обезличенным образцам с лимитом на компанию, иначе эвристика по именам; ничего не сохраняет, применять через `crm_inbound_source_update`). Права CRM_VIEW и CRM_EDIT плюс раздел настроек виджетов, адрес источника по MCP не выдается. Пакет ничего не хранит: инструменты приходят с сервера.
- **1.14.0**: ИИ и расшифровка звонков в CRM. Новое: `crm_task_postpone` (перенос открытой задачи по пресету 15m, 1h, today, tomorrow, weekEnd, week), `crm_ai_note_draft` (черновик примечания к сделке или контакту по заданию, ничего не сохраняет), `crm_ai_ask` (ответ на вопрос по карточке и ленте, расшифровки звонков включены; расход идет на ИИ-баланс компании, 402 при нехватке, лимит 30 в минуту и 300 в сутки, 429), `crm_call_transcript_settings` и `crm_call_transcript_settings_set` (расшифровка звонков с записью в примечания, по умолчанию выключена, ИИ-резюме по желанию; нужен раздел настроек виджетов), `crm_call_transcribe` (запустить расшифровку одного звонка по callId, повтор не дублирует примечание) и `crm_call_transcript_status`. Права CRM_VIEW и CRM_EDIT плюс права карточки по матрице. Данные карточки передаются модели как недоверенные, без токенов, почт и телефонов. Голосовой ввод только в браузере. Пакет ничего не хранит: инструменты приходят с сервера.
- **1.15.0**: браузерный софтфон CRM (UIS WebRTC). Новое: `crm_softphone_status` (доступен ли вам софтфон: привязка номера и SIP-учетка), `crm_softphone_accounts` (SIP-учетки менеджеров: логин, хост, WSS, есть ли пароль; пароль не показывается), `crm_softphone_account_set` (логин, хост и WSS существующей учетки; пароль по MCP не передается, его вводит администратор в Настройках CRM, Телефония), `crm_softphone_account_remove`. Права CRM_VIEW и CRM_EDIT плюс раздел настроек виджетов. Пакет ничего не хранит: инструменты приходят с сервера.
- **Серверные инструменты (без обновления пакета)**: `crm_distribution_settings` (правила распределения: метод по очереди / по нагрузке / по процентам, участники с весами, задержка, график и онлайн, дневной лимит, `maxActive` и `maxActiveStageIds` для лимита открытых сделок, `fromUserIds` для распределения только сделок указанных ответственных, тот же менеджер для контакта, перенос задач и контактов) и `crm_distribution_settings_save` (сохранить объект целиком с тем же version). Права CRM_VIEW и CRM_EDIT плюс раздел настроек дублей и распределения.
- **1.5.0**: меньше токенов на массовых задачах. `list_tasks` и `list_deals` по умолчанию отдают компактные строки (задача: id, title, status, deadline, исполнитель; сделка: id, stage, price, менеджер, даты, причина отказа), полный вид по `full: true`. Новое: `bulk_update_tasks` (до 200 задач за вызов по списку id или фильтру: срок, исполнитель, приоритет, выполнено; права проверяются на каждую задачу, в ответе только итог и причины пропусков; не больше 3 групповых вызовов в минуту; в чате одна карточка подтверждения со сводкой), `task_stats` (агрегаты по задачам: исполнитель, статус, проект, период) и `deal_stats` (агрегаты по сделкам: менеджер, статус, причина отказа, источник, этап; только цифры).
- **1.4.0**: график метрики `show_metric_chart` (выручка, выигранные и новые сделки, конверсия, средний чек за период и сравнение с прошлым; клиенты без UI получают текст), автопилот: `get_autopilot_settings`, `update_autopilot_settings` (запись, через карточку подтверждения), `get_autopilot_log`. Автопилот по умолчанию выключен.
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
