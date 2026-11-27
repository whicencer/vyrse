# Vyrse — целевая архитектура

Документ описывает, **как должна быть устроена система**, а не куда переложить текущие файлы.
Задача: под эту схему переписать проект, перенося логику по смыслу, а модули, которые делают
слишком много, разрезать по границам ниже.

---

## 0. Почему переделываем

Проблемы, от которых архитектура должна избавить:

| Проблема | Как проявляется |
|---|---|
| Один модуль = много ответственностей | Один файл одновременно держит историю чатов, таймеры склейки, навигацию очков, вызовы ИИ, политику автоответов, черновики, голос и сборку экрана |
| Состояние размазано по глобальным `Map` | `queues`, `histories`, `sessions`, `knowledge`, `ownerNames` — в разных файлах, без владельца и без интерфейса |
| Неявные зависимости | Колбэки через сеттеры (`onSendReply`, `onQueueChange`), импорт серверных типов из приложения очков относительным путём |
| Самодельный RPC между процессами | Бот и сервер общаются по WS, ответ коррелируется эхом `batchId`, `ownerId` гоняется туда-обратно, нужна отдельная проверка владельца |
| Демо — частный случай внутри ядра | `if (connectionId === DEMO_CONNECTION)` в отправке |
| UI-состояние в домене | «Какой чат открыт на очках» хранится в серверной очереди |
| Тексты для пользователя в ядре | HTML-уведомления бота собираются в серверной логике |
| Протокол без схемы и версий | `JSON.parse` + `switch`, никаких проверок входа |
| Нечем тестировать | Таймеры, OpenAI и сокеты вшиты прямо в логику |

---

## 1. Принципы

1. **Модульный монолит.** Один серверный процесс, внутри — модули с явными границами. Разносить на сервисы будем, только когда появится реальная причина (нагрузка, отдельная команда).
2. **Порты и адаптеры (гексагональная архитектура).** Ядро не знает про grammY, OpenAI, `ws`, Even Hub SDK, файлы и `setTimeout`. Всё внешнее — за интерфейсом (портом), реализация — в адаптере.
3. **Правило зависимостей:** `adapters → application → domain`. Никогда наоборот. Домен — чистый TypeScript без IO и без async.
4. **Команды делают работу, события оповещают.** Основной сценарий — явные вызовы use case'ов. События — только для побочной реакции (обновить очки, уведомить в боте, записать в журнал). Никаких цепочек «событие запускает событие, которое запускает событие».
5. **Сервер — источник правды о данных, клиент — о навигации.** Сервер отдаёт модель данных; что сейчас открыто на экране очков, решает клиент.
6. **Каждый канал — адаптер.** Telegram, демо, (потом WhatsApp/почта) — одинаковые реализации одного порта. Ядро не различает их.
7. **Контракты со схемой.** Всё, что приходит снаружи (WS, env, ответ LLM), валидируется на границе (zod) и дальше идёт уже типизированным.
8. **Один владелец у каждого состояния.** Состояние лежит в репозитории своего модуля; другие модули ходят только через его API.

---

## 2. Топология

```
                        ┌─────────────────────────── server (1 процесс) ───────────────────────────┐
 Telegram Bot API ◀───▶ │ adapters/telegram ─┐                                  ┌─ adapters/openai │ ◀──▶ OpenAI
  (polling/webhook)     │                    ▼                                  │  (LLM, STT)      │
                        │              application (use cases) ◀──▶ domain      │                  │
 Even app (WebView) ◀──▶│ adapters/glasses ──▲          │                       └─ adapters/storage│ ◀──▶ memory / SQLite
  очки + страница       │   (WS gateway)     │          ▼ события                                  │
  на телефоне           │                    └──── event bus ──▶ presenters / notifier / журнал    │
                        │ adapters/demo (сценарные чаты)                                           │
                        └──────────────────────────────────────────────────────────────────────────┘
```

- **Бот — не отдельный процесс, а адаптер внутри сервера.** Это убирает весь протокол бот↔сервер, корреляцию ответов и проверку «а точно ли ownerId тот». Polling сейчас, webhook позже — на тот же HTTP-сервер (`/telegram/webhook`, `/ws`, `/health`).
- Если когда-нибудь бот понадобится вынести — граница уже есть: порт `Messenger` + входящие команды. Выносится адаптер, ядро не меняется.
- **Клиент очков** — отдельное приложение, общается с сервером только по WS-протоколу из пакета `protocol`.

---

## 3. Структура репозитория

```
vyrse/
├── package.json                 pnpm workspaces
├── packages/
│   └── protocol/                контракт очки ↔ сервер (единственный общий код)
│       └── src/
│           ├── envelope.ts      { v, id, type, payload }, ack/error
│           ├── client.ts        сообщения клиент → сервер (zod-схемы + типы)
│           ├── server.ts        сообщения сервер → клиент
│           └── view.ts          модели представления (InboxView, ItemView, SettingsView…)
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── main.ts          composition root: собрать всё и запустить
│   │       ├── config.ts        env → zod → типизированный конфиг (единственное место с process.env)
│   │       ├── http.ts          один HTTP-сервер: /ws, /telegram/webhook, /health
│   │       ├── shared/          общие кирпичи: ids, clock, scheduler, event-bus, logger, errors, result
│   │       ├── modules/         ЯДРО (см. §4)
│   │       │   ├── identity/
│   │       │   ├── conversations/
│   │       │   ├── inbox/
│   │       │   ├── secretary/
│   │       │   ├── messaging/
│   │       │   └── demo/
│   │       └── adapters/        ВНЕШНИЙ МИР (см. §6)
│   │           ├── telegram/
│   │           ├── glasses/
│   │           ├── openai/
│   │           ├── demo/
│   │           └── storage/
│   └── glasses/                 Even Hub приложение (см. §10)
│       ├── app.json
│       └── src/
└── docs/
    ├── ARCHITECTURE.md
    └── CONCEPT.md
```

Каждый модуль ядра устроен одинаково:

```
modules/<name>/
├── domain/        сущности, value objects, чистые правила. Без IO, без async, без Date.now()
├── application/   use cases: один файл = одна операция. Оркестрируют домен и порты
├── ports.ts       интерфейсы, которые модуль требует от внешнего мира (репозитории, шлюзы)
├── events.ts      события, которые модуль публикует
└── index.ts       публичный API модуля. Другие модули импортируют ТОЛЬКО отсюда
```

---

## 4. Модули ядра

### 4.1. `identity` — кто владелец и чем он подключён

| Сущность | Что хранит |
|---|---|
| `Owner` | `ownerId` (Telegram user id), имя, язык |
| `ChannelConnection` | канал (`telegram` / `demo`), `connectionId`, `ownerId`, включено ли, права (`canReply`) |
| `Device` | токен устройства (очки), `ownerId`, когда спарено |
| `PairingCode` | 6 цифр, TTL, ожидающая сессия |

Use cases: `RegisterConnection` (пришёл `business_connection`), `ResolveOwnerByConnection`, `RequestPairingCode`, `ConfirmPairing`, `AuthenticateDevice`.

Правило: **владелец определяется только здесь**. Адаптеры никогда не передают `ownerId` «на веру» — они передают `connectionId` или токен устройства, а модуль отвечает, чей это.

### 4.2. `conversations` — полная история переписки

| Сущность | Что хранит |
|---|---|
| `ChatRef` (value object) | `{ channel, connectionId, chatId }` + `key()`. Единственный способ адресовать чат |
| `Conversation` | `ChatRef`, имя контакта, последние N реплик `Turn { author: contact \| owner \| secretary, text, externalId?, at }` |

Операции: добавить реплику, отредактировать по `externalId`, удалить, обрезать до лимита.

Здесь же — **чистая функция `buildAgentContext(conversation, item)`** → `{ history, open, toAnswer }`. Она не знает про OpenAI, просто режет историю. Её легко покрыть тестами.

Модуль ничего не решает про очки и ИИ — это просто память о переписке.

### 4.3. `inbox` — что требует внимания владельца

Центральный модуль. Сущность **`InboxItem`** — одно «обращение» контакта (пачка сообщений подряд). Не больше одного открытого обращения на `ChatRef`.

```ts
type InboxItem = {
  id: ItemId
  chat: ChatRef
  contactName: string
  messageIds: string[]          // какие реплики Conversation входят в обращение
  revision: number              // растёт на каждое изменение входа → защита от устаревших ответов
  state: ItemState
  triage: Triage | null         // summary + варианты (intents)
  draft: Draft                  // none | writing | ready | failed
  escalated: boolean            // хоть раз показывали владельцу → сразу виден при новых сообщениях
  holdSent: boolean             // секретарь уже сказал «Алекс ответит» (один раз на обращение)
  openedAt: number
}

type ItemState =
  | 'collecting'    // контакт пишет, ждём тишины
  | 'triaging'      // ждём решения агента
  | 'auto_replying' // секретарь отправляет ответ сам
  | 'needs_owner'   // на очках, ждёт владельца
  | 'resolved'      // закрыто (терминальное)
```

Машина состояний (вся логика переходов — методы сущности, а не `if` в обработчиках):

```
            новое сообщение (revision++)
   ┌───────────────────────────────────────────────────────┐
   ▼                                                       │
collecting ──тишина N с──▶ triaging ──agent: answered──▶ auto_replying ──доставлено──▶ resolved
                              │                              │
                              │                              └──ошибка доставки──┐
                              └──agent: needs_owner / ошибка агента──▶ needs_owner ◀┘
                                                                         │
                       ответ с очков / ответ с телефона / «Игнорировать» ─┴──▶ resolved
```

`resolved` хранит причину: `owner_replied`, `replied_elsewhere`, `secretary_answered`, `dismissed`.

**Видимость на очках — производное правило, а не флаг:**
`visible = state === 'needs_owner' || (state === 'collecting' && escalated)`.

**Черновик** (`Draft`) — подсостояние `needs_owner`: `none → writing(intent) → ready(text) | failed`. Новое сообщение сбрасывает черновик и варианты.

**Склейка пачек (burst)** — отдельный доменный объект `BurstPolicy`: по сообщению и текущему состоянию отвечает «сколько ждать тишины» (сейчас константа, потом эвристики: после «привет» дольше, после вопроса короче). Сам таймер — через порт `Scheduler` (см. §7), поэтому тестируется с фейковыми часами.

Use cases:
- `IngestMessage` — сообщение от контакта: в `Conversation` + в открытое обращение (или новое), перезапуск таймера.
- `EditMessage`, `DeleteMessages` — правка/удаление контактом.
- `CompleteBurst` — сработал таймер: `collecting → triaging`, запустить триаж.
- `MarkRepliedElsewhere` — владелец ответил с телефона.
- `ChooseIntent`, `DictateReply`, `DiscardDraft`, `SendDraft`, `DismissItem` — действия владельца с очков.

### 4.4. `secretary` — режим, база знаний, политика автоответов, журнал

| Сущность | Что хранит |
|---|---|
| `SecretarySettings` | на владельца: `mode: { on, since } \| off`, стиль ответов |
| `KnowledgeBase` | список фактов с **стабильными id** (не индексами массива — индексы ломаются при удалении) |
| `ActivityLog` | что секретарь ответил сам за текущую сессию режима |

Сердце модуля — **`ReplyPolicy` (чистая функция)**:

```ts
decide(analysis: Analysis, ctx: { mode, knowledge, item }): Decision

type Decision =
  | { kind: 'auto_answer', text: string }              // ответить и закрыть
  | { kind: 'escalate', holdText?: string }            // на очки (+ «Алекс ответит», если ещё не говорили)
```

Здесь живут все правила автономии: ответ только при включённом режиме, проверка что использованные факты реально есть в базе (grounding), пометка 🤖, «hold» один раз на обращение, «ошибка агента → всегда владельцу». Агент только предлагает, **решает политика**.

Use cases:
- `TriageItem` — собрать контекст → `TriageAgent.analyze` → `ReplyPolicy.decide` → применить к `InboxItem` (с проверкой `revision`) → при необходимости поставить ответ в отправку.
- `SetSecretaryMode` — вкл/выкл; при выключении формирует `Digest` из `ActivityLog`.
- `AddFact`, `RemoveFact`.
- `RecordSecretaryReply` — реакция на доставку автоответа → запись в журнал.

### 4.5. `messaging` — исходящие сообщения

Единая точка отправки **любого** сообщения контакту.

```ts
type OutgoingReply = {
  id: ReplyId
  chat: ChatRef
  itemId: ItemId
  text: string
  author: 'owner' | 'secretary'
  purpose: 'answer' | 'hold'   // hold не закрывает обращение
}
```

Use case `DeliverReply`: выбрать адаптер по `chat.channel` (через `MessengerRouter`), отправить, записать реплику в `Conversation`, опубликовать `ReplyDelivered` / `ReplyFailed`. Дальше `inbox` и `secretary` реагируют на результат (закрыть обращение, записать в журнал, вернуть на очки при ошибке).

Корреляция — по `ReplyId`, всё в одном процессе: `await messenger.send(...)` возвращает результат напрямую.

### 4.6. `demo` — сценарий для судей

Use case `StartDemo`: включить режим, загрузить демо-базу знаний, создать демо-подключение в `identity`, запустить сценарий. Сценарий подаёт сообщения через **тот же `IngestMessage`**, что и Telegram. Отправка в демо-чаты идёт через `DemoMessenger` (адаптер, см. §6) — ядро про демо ничего не знает.

---

## 5. Порты (интерфейсы ядра)

```ts
// ── внешние сервисы ─────────────────────────────────────────
interface Messenger {                       // реализации: TelegramMessenger, DemoMessenger
  readonly channel: Channel
  send(chat: ChatRef, text: string): Promise<{ externalId: string }>
}

interface TriageAgent {                     // OpenAITriageAgent
  analyze(input: TriageInput): Promise<Analysis>   // summary, intents, proposed reply, usedFactIds
}

interface ReplyWriter {                     // OpenAIReplyWriter
  write(input: { context: AgentContext; intent: string; knowledge: Fact[] }): Promise<string>
  polishDictation(input: { context: AgentContext; transcript: string }): Promise<string>
}

interface SpeechToText {                    // OpenAISpeechToText
  transcribe(audio: AudioClip): Promise<string>
}

interface OwnerNotifier {                   // TelegramOwnerNotifier (сообщения владельцу в бота)
  notify(ownerId: OwnerId, n: OwnerNotification): Promise<void>   // типизированное событие, НЕ готовый текст
}

// ── инфраструктура ──────────────────────────────────────────
interface Clock { now(): number }
interface Scheduler {                       // timers, отменяемые по ключу
  schedule(key: string, delayMs: number, job: () => void): void
  cancel(key: string): void
}
interface EventBus {
  publish(e: DomainEvent): void
  subscribe<T extends DomainEvent['type']>(type: T, h: (e: Extract<DomainEvent, { type: T }>) => void): void
}

// ── репозитории (по одному на агрегат) ──────────────────────
interface OwnerRepo, ConnectionRepo, DeviceRepo, ConversationRepo,
          InboxRepo, SecretarySettingsRepo, KnowledgeRepo, ActivityLogRepo
```

Сейчас все репозитории — in-memory. Потом SQLite — меняется только `adapters/storage`.

`OwnerNotification` — это данные (`{ kind: 'mode_changed', on: true }`, `{ kind: 'digest', entries }`, `{ kind: 'device_paired' }`…). **Тексты и HTML собирает адаптер Telegram**, не ядро.

---

## 6. Адаптеры

### 6.1. `adapters/telegram`

```
telegram/
├── bot.ts                 создание grammY Bot, middleware, обработка ошибок, polling/webhook
├── inbound/
│   ├── business.ts        business_connection / business_message / edited / deleted → use cases
│   ├── commands.ts        /start /pair /mode /demo → use cases (тот же API, что у страницы на телефоне)
│   └── mapping.ts         Telegram Update → доменные входные данные (ChatRef, текст, дата)
├── outbound/
│   ├── messenger.ts       implements Messenger (business_connection_id)
│   └── notifier.ts        implements OwnerNotifier
└── texts.ts               все пользовательские тексты бота в одном месте (потом — i18n)
```

Входящие обработчики **тонкие**: распарсить → вызвать use case → всё. Никакой логики «это владелец или контакт» — это решает `inbox` через `identity`.

### 6.2. `adapters/glasses` — WS-шлюз

```
glasses/
├── gateway.ts       WS upgrade, аутентификация по токену устройства, жизненный цикл сокета
├── sessions.ts      SessionRegistry: ownerId → активные сессии (несколько устройств — норм)
├── commands.ts      входящее сообщение протокола (уже провалидировано zod) → use case → ack/error
└── presenter.ts     состояние ядра → модели представления из packages/protocol/view.ts
```

Presenter подписан на события (`ItemChanged`, `ModeChanged`, `KnowledgeChanged`…), для затронутого владельца собирает view и шлёт всем его сессиям. Обновления **схлопываются** (одна отправка за тик на владельца), чтобы серия событий не порождала серию сообщений.

Доменные типы наружу не уходят: очки получают только view-модели. Можно менять домен, не ломая клиент.

### 6.3. `adapters/openai`

```
openai/
├── client.ts           один экземпляр OpenAI, ретраи, таймауты
├── triage-agent.ts     implements TriageAgent
├── reply-writer.ts     implements ReplyWriter
├── speech-to-text.ts   implements SpeechToText (PCM → WAV здесь же, в audio.ts)
├── prompts/            тексты промптов отдельными файлами
└── schemas.ts          JSON-схемы ответа + zod-проверка того, что вернула модель
```

Адаптер отвечает за «как спросить модель» и «проверить ответ». Решения («отвечать ли самому») — не здесь, а в `ReplyPolicy`.

### 6.4. `adapters/demo`

`DemoMessenger implements Messenger` (отправка «успешна» с задержкой, ответ видно в логе) + сценарий-скрипт, который через `Scheduler` вызывает `IngestMessage`.

### 6.5. `adapters/storage/memory`

По файлу на репозиторий. Простые `Map` за интерфейсом.

---

## 7. Сквозные механизмы

### 7.1. Конкурентность: последовательная обработка на владельца

В Node нет потоков, но есть гонки между `await`: ответ агента приходит, пока контакт дописал сообщение; владелец ответил с телефона, пока отправлялся автоответ.

Правило: **все команды одного владельца выполняются последовательно** через `OwnerLane` (очередь промисов по `ownerId`). Use case держит «полосу» только на время чтения/изменения состояния, а **долгие вызовы (LLM, STT, отправка) делает вне полосы**:

```
lane(owner) { item = repo.get(); rev = item.revision; item.startTriage(); repo.save(item) }
analysis = await agent.analyze(...)          // вне полосы — не блокирует владельца
lane(owner) { item = repo.get(); item.applyTriage(rev, analysis) /* игнор, если rev устарел */ ; ... }
```

### 7.2. Устаревшие ответы

Не `version`-счётчики по коду, а **правило в сущности**: каждый асинхронный результат применяется методом с `revision` (`applyTriage(rev, …)`, `applyDraft(rev, draftId, …)`), который сам решает, не устарел ли результат. Логика защиты в одном месте.

### 7.3. Время и таймеры

Нигде в ядре нет `Date.now()` и `setTimeout` — только `Clock` и `Scheduler`. В тестах — `FakeClock.advance(10_000)`, и склейка пачек проверяется без ожидания.

### 7.4. События

Публикуются use case'ами после успешного изменения состояния:

| Событие | Кто публикует | Кто слушает |
|---|---|---|
| `ItemChanged { ownerId, itemId }` | inbox | glasses presenter |
| `ItemResolved { ownerId, itemId, reason }` | inbox | presenter |
| `ReplyDelivered / ReplyFailed { replyId, … }` | messaging | inbox (закрыть / вернуть владельцу), secretary (журнал), presenter («Отправлено») |
| `SecretaryModeChanged { ownerId, on, digest? }` | secretary | presenter, notifier |
| `KnowledgeChanged { ownerId }` | secretary | presenter |
| `ConnectionChanged`, `DevicePaired` | identity | notifier, presenter |

### 7.5. Конфиг, логи, ошибки

- `config.ts` в каждом приложении: zod-схема env, падение на старте с понятной ошибкой. Больше нигде `process.env`.
- Логгер со структурой (`pino`): `{ ownerId, itemId, chat }` в контексте, а не `console.log` со строками.
- Доменные ошибки — типизированные (`ItemNotFound`, `DraftNotReady`), шлюз очков превращает их в `ack { ok: false, code }`.

### 7.6. Безопасность

- Клиент очков аутентифицируется **только токеном устройства**, полученным при спаривании. Общий секрет в бандле клиента не секрет — его не должно быть.
- Текст отправки берётся **только из серверного черновика** (клиент шлёт `send { itemId }`, не текст).
- Сообщения контакта передаются модели как данные (prompt-injection guard) — правило адаптера `openai`, плюс grounding-проверка в `ReplyPolicy`.
- Входные данные клиента ограничены схемой (длина факта, длительность аудио).

---

## 8. Ключевые сценарии

**Входящее сообщение → автоответ или очки**

```
Telegram ─business_message─▶ telegram/inbound/business
  └▶ identity.resolveOwner(connectionId) ─▶ inbox.IngestMessage
        ├ conversations: добавить реплику
        ├ InboxItem: добавить сообщение, revision++, state=collecting
        └ scheduler.schedule(item, BurstPolicy.silence(...)) ──тишина──▶ inbox.CompleteBurst
                                                                         └▶ secretary.TriageItem
              context = buildAgentContext(conversation, item)
              analysis = await TriageAgent.analyze(...)
              decision = ReplyPolicy.decide(analysis, mode, kb, item)
              ├ auto_answer → item.auto_replying → messaging.DeliverReply(author=secretary)
              │                 └ ReplyDelivered → item.resolved + ActivityLog.add
              └ escalate    → item.needs_owner (+ DeliverReply(purpose=hold), если нужно)
                                └ ItemChanged → presenter → очки
```

**Ответ с очков**

```
очки: choose { itemId, intent } ─▶ inbox.ChooseIntent ─▶ draft=writing ─▶ ReplyWriter.write ─▶ draft=ready
очки: send { itemId }           ─▶ inbox.SendDraft ─▶ messaging.DeliverReply(author=owner, text=draft.text)
                                     └ ReplyDelivered → item.resolved → presenter (+ «Отправлено»)
```

**Голосовой ответ:** `voice { itemId, audio }` → `inbox.DictateReply` → `SpeechToText.transcribe` → `ReplyWriter.polishDictation` → тот же `draft=ready` → дальше как выше.

**Ответ с телефона:** `business_message` от владельца → `inbox.MarkRepliedElsewhere` → реплика в историю, обращение `resolved`.

**Выключение режима:** `/mode off` или переключатель → `secretary.SetSecretaryMode(off)` → `Digest` из журнала → событие → presenter показывает дайджест на очках, notifier пишет в бота.

---

## 9. Протокол очки ↔ сервер (`packages/protocol`)

Конверт:

```ts
// клиент → сервер
{ v: 1, id: "c-17", type: "item.choose", payload: { itemId, intentIndex } }
// сервер → клиент: ответ на команду
{ v: 1, type: "ack", payload: { id: "c-17", ok: true } }
{ v: 1, type: "ack", payload: { id: "c-17", ok: false, code: "DRAFT_NOT_READY" } }
// сервер → клиент: состояние
{ v: 1, type: "state", payload: { inbox: InboxView, settings: SettingsView } }
{ v: 1, type: "event", payload: { kind: "digest", ... } }
```

Команды клиента (именование `область.действие`):
`item.choose`, `item.dictate`, `item.discardDraft`, `item.send`, `item.dismiss`,
`mode.set`, `knowledge.add`, `knowledge.remove`, `demo.start`, `pairing.request`.

Чего в протоколе **нет**: `open` (навигация — дело клиента) и `ownerId` (сервер знает его по сессии).

View-модели:

```ts
type InboxView = {
  items: ItemView[]          // все видимые обращения, по порядку; с деталями — их мало
}
type ItemView = {
  id: string
  contactName: string
  messages: string[]
  collecting: boolean
  triage: { status: 'pending' } | { status: 'ready'; summary: string; intents: string[] } | { status: 'failed' }
  draft: { status: 'none' } | { status: 'writing'; label: string } | { status: 'ready'; text: string } | { status: 'failed'; reason: 'agent' | 'voice' }
}
type SettingsView = { mode: { on: false } | { on: true; since: number }; knowledge: { id: string; text: string }[]; device: { pairedAs: string } | null }
```

Схемы — zod, типы выводятся из схем (`z.infer`). Сервер валидирует вход, клиент — тоже (дешёвая защита от рассинхрона версий).

---

## 10. Приложение для очков (`apps/glasses`)

Однонаправленный поток данных: **события → состояние → описание экрана → отрисовка**.

```
apps/glasses/src/
├── main.ts                 composition root
├── config.ts
├── platform/               всё, что трогает Even Hub SDK
│   ├── bridge.ts           ожидание моста
│   ├── input.ts            SDK-события → Gesture { tap(target, index) | doubleTap | swipe(up/down) | holdStart | holdEnd }
│   ├── renderer.ts         ScreenSpec → вызовы SDK; сам решает: rebuild страницы или textContainerUpgrade (сравнивает «скелет»)
│   ├── microphone.ts       запись PCM
│   └── storage.ts          localStorage моста (токен)
├── net/
│   ├── connection.ts       WS, переподключение, конверт, id команд, ожидание ack
│   └── api.ts              типизированные методы: api.item.choose(...), api.mode.set(...)
├── state/
│   ├── store.ts            { server: { inbox, settings }, ui: UiState }, subscribe/dispatch
│   ├── ui-state.ts         route ('inbox' | {item} | {draft} | 'recording' | {digest, page}), выделенный пункт, тост «Отправлено»
│   └── reducer.ts          (state, Action) → state. Чистая функция, покрывается тестами
├── screens/                по файлу на экран. Каждый — два чистых метода:
│   ├── inbox.ts            view(state): ScreenSpec
│   ├── item.ts             onGesture(state, gesture): Action[]   (действия для store и/или команды на сервер)
│   ├── draft.ts
│   ├── recording.ts
│   ├── digest.ts
│   └── toast.ts
├── ui/                     библиотека отрисовки под G2 (не знает про Vyrse)
│   ├── metrics.ts          размеры холста, высоты строк, отступы (измерено в симуляторе)
│   ├── text.ts             ширина глифов, wrap, fitLines, лимиты байт
│   └── components.ts       header(), card(), list(), fullText() → описания контейнеров
└── phone/                  страница на телефоне, по модулю на секцию
    ├── connection-status.ts
    ├── pairing.ts
    ├── secretary-mode.ts
    └── knowledge.ts
```

Ключевые правила клиента:
- **Экраны — чистые функции.** `view(state)` возвращает декларативное описание (`ScreenSpec`: список контейнеров с контентом), а не дёргает SDK. Отсюда — тестируемость и отсутствие ручного «что перерисовать».
- **Renderer — единственное место, которое вызывает SDK отрисовки.** Он держит очередь вызовов и решает, хватит ли обновить текст или нужен rebuild.
- **Навигация — локальное состояние клиента.** Когда открытое обращение исчезло из `inbox` (закрыли с телефона) — reducer сам возвращает на список.
- **Новые данные не прерывают ввод.** Правило в reducer'е: пока `route` = черновик/запись, входящий `state` только обновляет данные, но не меняет экран.
- Страница на телефоне подписывается на тот же store и шлёт команды через тот же `api`.

---

## 11. Тесты

| Уровень | Что | Как |
|---|---|---|
| Домен | `InboxItem` переходы, `BurstPolicy`, `ReplyPolicy`, `buildAgentContext`, `KnowledgeBase` | Чистые unit-тесты, без моков |
| Use cases | «4 сообщения подряд → одна пачка → автоответ», «ответ с телефона закрывает», «устаревший ответ агента игнорируется» | In-memory репозитории + `FakeClock` + `FakeAgent` + `FakeMessenger` |
| Протокол | Схемы принимают/отклоняют | zod-тесты |
| Клиент | reducer, `screens/*.view`, `ui/text` | Чистые unit-тесты |
| Промпты | Набор диалогов → ожидаемые решения (answered / needs_owner, не выдумывает факты) | Отдельный eval-скрипт на реальной модели, не в CI |

Демо-сценарий заодно служит end-to-end тестом: прогнать его с `FakeAgent` и проверить итоговое состояние.

---

## 12. Сознательно не делаем сейчас (и где это потом встанет)

| Что | Куда встанет |
|---|---|
| SQLite / Postgres | новые реализации в `adapters/storage`, ядро не меняется |
| Webhook вместо polling | `adapters/telegram/bot.ts` + маршрут в `http.ts` |
| Другие мессенджеры | новый `Messenger` + входящий адаптер; `ChatRef.channel` уже есть |
| Несколько устройств на владельца | `SessionRegistry` уже хранит список сессий |
| Вынос бота в отдельный процесс | граница — порт `Messenger` и входящие use case'ы; появится очередь между процессами |
| VIP-приоритет, умная тишина | `BurstPolicy` и порядок в `InboxRepo` |
| Mini App настроек | ещё один клиент протокола `packages/protocol` |

---

## 13. Порядок переписывания

1. `packages/protocol` — схемы и view-модели. С этого момента клиент и сервер договорились.
2. `shared/` (clock, scheduler, event bus, owner lane, logger) + `config.ts`.
3. Домен `conversations` и `inbox` с тестами на машину состояний и склейку.
4. `secretary`: `ReplyPolicy` с тестами, база знаний, журнал.
5. `messaging` + `DemoMessenger` → можно прогнать демо целиком без Telegram и OpenAI (`FakeAgent`).
6. Адаптеры `openai`, `glasses` (шлюз + presenter), `telegram`.
7. Клиент очков: `ui/` → `platform/renderer` → `state` → `screens` → `phone`.
