-- Initial schema. Times are unix milliseconds.

-- Telegram accounts that connected the bot.
CREATE TABLE owners (
  id         INTEGER PRIMARY KEY,         -- Telegram user id
  name       TEXT    NOT NULL,
  mode_since INTEGER                      -- secretary mode on since; NULL = off
) STRICT;

-- Telegram Business connections (or the demo connection) of an owner.
CREATE TABLE connections (
  id       TEXT    PRIMARY KEY,           -- business_connection_id
  owner_id INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  enabled  INTEGER NOT NULL DEFAULT 1
) STRICT;

-- Paired glasses: they connect with this token.
CREATE TABLE devices (
  token      TEXT    PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
) STRICT;

-- Facts the secretary may use on its own.
CREATE TABLE knowledge (
  id         INTEGER PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

-- What the secretary answered by itself. Digest = rows since owners.mode_since.
CREATE TABLE secretary_log (
  id           INTEGER PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  contact_name TEXT    NOT NULL,
  asked        TEXT    NOT NULL,
  reply        TEXT    NOT NULL,
  at           INTEGER NOT NULL
) STRICT;

-- Open items: a burst from one contact that the owner or the secretary hasn't answered yet.
-- Deleted when answered or dismissed; its messages stay in `messages`.
CREATE TABLE items (
  id              TEXT    PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  channel         TEXT    NOT NULL CHECK (channel IN ('telegram', 'demo')),
  connection_id   TEXT    NOT NULL,
  chat_id         INTEGER NOT NULL,
  contact_name    TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('collecting', 'thinking', 'needs_owner', 'auto_replying')),
  revision        INTEGER NOT NULL DEFAULT 0,   -- bumped on every new message: late AI answers are dropped
  summary         TEXT,
  options         TEXT,                          -- JSON array of intents
  analysis_failed INTEGER NOT NULL DEFAULT 0,
  draft_status    TEXT    CHECK (draft_status IN ('writing', 'ready', 'failed', 'voice_failed')),
  draft_intent    TEXT,
  draft_text      TEXT,
  shown           INTEGER NOT NULL DEFAULT 0,   -- has been on the glasses
  hold_sent       INTEGER NOT NULL DEFAULT 0,   -- secretary already said the owner will get back
  auto_asked      TEXT,                          -- what the contact asked, while the secretary's own answer is being sent
  opened_at       INTEGER NOT NULL,
  UNIQUE (owner_id, channel, connection_id, chat_id)
) STRICT;

-- Whole conversation history, per chat.
CREATE TABLE messages (
  id            INTEGER PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  channel       TEXT    NOT NULL CHECK (channel IN ('telegram', 'demo')),
  connection_id TEXT    NOT NULL,
  chat_id       INTEGER NOT NULL,
  author        TEXT    NOT NULL CHECK (author IN ('contact', 'owner', 'secretary')),
  text          TEXT    NOT NULL,
  external_id   INTEGER,                         -- Telegram message_id, to apply edits
  item_id       TEXT    REFERENCES items (id) ON DELETE SET NULL,
  at            INTEGER NOT NULL
) STRICT;

CREATE INDEX messages_by_chat ON messages (owner_id, channel, connection_id, chat_id, id);
CREATE INDEX messages_by_item ON messages (item_id);
CREATE INDEX items_by_owner   ON items (owner_id, opened_at);
CREATE INDEX log_by_owner     ON secretary_log (owner_id, at);
