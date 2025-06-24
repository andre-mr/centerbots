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
    license_key         TEXT,                                -- License key for activation
    dark_mode           INTEGER NOT NULL DEFAULT 0,          -- 0 = false, 1 = true (UI theme)
    user_id             TEXT,                                -- User identifier
    plan_status         TEXT    NOT NULL,                    -- PlanStatus: 'Valid', 'Grace', 'Invalid'
    plan_tier           TEXT    NOT NULL,                    -- PlanTier: 'Basic', 'Full'
    registered_bots     TEXT    NOT NULL DEFAULT '[]',       -- JSON array of registered bot IDs
    app_version         TEXT    NOT NULL DEFAULT '1.0.0',    -- Application version
    machine_id          TEXT,                                -- Unique machine identifier
    last_ip             TEXT,                                -- Last known public IP address
    last_checkin        TEXT    NOT NULL,                    -- ISO datetime of last license check
    platform            TEXT                                 -- OS platform (windows, linux, darwin, etc.)
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
    updated                 TEXT    NOT NULL,             -- ISO datetime
    proxy                   TEXT                          -- Proxy URL (opcional)
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

-- Indexes to speed up basic statistics queries:

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
    console.error("❌ Error connecting to the database!");
    throw err;
  }
});

export const dbReady: Promise<void> = new Promise((resolve, reject) => {
  database.run("PRAGMA foreign_keys = ON", (err) => {
    if (err) {
      console.error("❌ Error enabling foreign keys!");
      reject(err);
      return;
    }
    database.exec(schema, (err) => {
      if (err) {
        console.error("❌ Error configuring the database schema!");
        reject(err);
      } else {
        const initSql = `
          INSERT OR IGNORE INTO app_config (id, license_key, dark_mode, user_id, plan_status, plan_tier, registered_bots, app_version, machine_id, last_ip, last_checkin, platform)
          VALUES (1, NULL, 0, NULL, 'Invalid', 'Basic', '[]', '1.0.0', NULL, NULL, '${new Date().toISOString()}', NULL);
        `;
        database.run(initSql, (initErr) => {
          if (initErr) {
            console.error("❌ Error initializing app_config!");
            reject(initErr);
          } else {
            resolve();
          }
        });
      }
    });
  });
});

export default database;
