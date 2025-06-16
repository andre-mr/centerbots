import fs from "fs";
import path from "path";
import { app } from "electron";
import sqlite3 from "sqlite3";

const dbPath = path.join(app.getPath("userData"), "centerbots.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

sqlite3.verbose();

const schema = `
-- General application configuration
CREATE TABLE IF NOT EXISTS app_config (
    id                  INTEGER PRIMARY KEY CHECK (id = 1), -- ensures only one row
    api_key             TEXT,
    auth_token          TEXT,
    dark_mode           INTEGER NOT NULL DEFAULT 0,       -- 0 = false, 1 = true
    user_info           TEXT,                             -- JSON or free string
    plan_status         TEXT    NOT NULL,                 -- PlanStatus: 'Valid', 'Grace', 'Invalid'
    plan_tier           TEXT    NOT NULL,                 -- PlanTier: 'Basic', 'Full'
    last_checked        TEXT    NOT NULL                  -- ISO datetime of last check
);

-- WhatsApp Bots
CREATE TABLE IF NOT EXISTS bots (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_number               TEXT,                         -- account number (e.g.: '553499991111')
    campaign                TEXT    NOT Null,             -- campaign name (e.g.: 'Promobot')
    whatsapp_sources        TEXT    NOT NULL,             -- WhatsAppSources: 'All', 'Direct', 'Group'
    send_method             TEXT    NOT NULL,             -- SendMethods: 'Text', 'Image', 'Forward'
    delay_between_groups    INTEGER NOT NULL DEFAULT 2,   -- in seconds
    delay_between_messages  INTEGER NOT NULL DEFAULT 10,  -- in seconds
    link_parameters         TEXT    NOT NULL,             -- Link parameters (LinkParameters: 'all', 'source', 'medium', 'none')
    updated                 TEXT    NOT NULL              -- ISO datetime
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid   TEXT    NOT NULL UNIQUE,    -- WhatsApp group ID
    name        TEXT
);

-- Members (WhatsApp accounts)
CREATE TABLE IF NOT EXISTS members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_jid  TEXT NOT NULL UNIQUE
);

-- Member ↔ group association (N:N)
CREATE TABLE IF NOT EXISTS group_members (
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, member_id)
);

-- Messages (queued or sent)
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    content         TEXT,                    -- message text
    timestamp       TEXT  NOT NULL,          -- ISO datetime of sending
    original_jid    TEXT,                    -- WhatsApp ID of the received message
    sender_jid      TEXT,                    -- sender's number
    image           BLOB                     -- message image
);

-- Authorized numbers per bot (N:N)
CREATE TABLE IF NOT EXISTS authorized_numbers (
    bot_id     INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    wa_number  TEXT    NOT NULL,
    PRIMARY KEY (bot_id, wa_number)
);

-- Bot ↔ group association (N:N)
CREATE TABLE IF NOT EXISTS bot_groups (
    bot_id     INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    broadcast  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bot_id, group_id)
);

-- Messages sent to bots (N:N)
CREATE TABLE IF NOT EXISTS bot_messages (
    message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, bot_id)
);

-- Suggested indexes to speed up basic statistics queries:

-- Fast search of groups by bot
CREATE INDEX IF NOT EXISTS idx_bot_groups_bot_id ON bot_groups(bot_id);

-- Fast search of bots by group (useful for reverse lookup)
CREATE INDEX IF NOT EXISTS idx_bot_groups_group_id ON bot_groups(group_id);

-- Efficient query of members by group
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);

-- Query for authorized number within a specific bot (avoids scan)
CREATE INDEX IF NOT EXISTS idx_authorized_numbers_bot_id ON authorized_numbers(bot_id);

-- Query of messages received by sender
CREATE INDEX IF NOT EXISTS idx_messages_sender_jid ON messages(sender_jid);

-- Efficient query of bots by message
CREATE INDEX IF NOT EXISTS idx_message_bots_message_id ON bot_messages(message_id);

-- Efficient query of messages by bot
CREATE INDEX IF NOT EXISTS idx_message_bots_bot_id ON bot_messages(bot_id);
`;

const database = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err.message);
    throw err;
  }
});

export const dbReady: Promise<void> = new Promise((resolve, reject) => {
  database.exec(schema, (err) => {
    if (err) {
      console.error(
        "❌ Erro ao configurar o esquema do banco de dados:",
        err.message
      );
      reject(err);
    } else {
      const initSql = `
        INSERT OR IGNORE INTO app_config (id, api_key, auth_token, dark_mode, user_info, plan_status, plan_tier, last_checked)
        VALUES (1, NULL, NULL, 0, NULL, 'Grace', 'Basic', '${new Date().toISOString()}');
      `;
      database.run(initSql, (initErr) => {
        if (initErr) {
          console.error("❌ Erro ao inicializar app_config:", initErr.message);
          reject(initErr);
        } else {
          resolve();
        }
      });
    }
  });
});

export default database;
