import fs from "fs";
import path from "path";
import { app } from "electron";
import sqlite3 from "sqlite3";

const dbPath = path.join(app.getPath("userData"), "centerbots.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

sqlite3.verbose();

const schema = `
-- Configuração geral da aplicação
CREATE TABLE IF NOT EXISTS app_config (
    id                  INTEGER PRIMARY KEY CHECK (id = 1), -- garante somente uma linha
    api_key             TEXT,
    auth_token          TEXT,
    dark_mode           INTEGER NOT NULL DEFAULT 0,       -- 0 = false, 1 = true
    user_info           TEXT,                             -- JSON ou string livre
    plan_status         TEXT    NOT NULL,                 -- PlanStatus: 'Valid', 'Grace', 'Invalid'
    plan_tier           TEXT    NOT NULL,                 -- PlanTier: 'Basic', 'Full'
    last_checked        TEXT    NOT NULL                  -- ISO datetime da última verificação
);

-- Bots WhatsApp
CREATE TABLE IF NOT EXISTS bots (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_number               TEXT,                         -- número da conta (ex: '553499991111')
    campaign                TEXT    NOT Null,             -- nome da campanha (ex: 'Promobot')
    whatsapp_sources        TEXT    NOT NULL,             -- WhatsAppSources: 'All', 'Direct', 'Group'
    send_method             TEXT    NOT NULL,             -- SendMethods: 'Text', 'Image', 'Forward'
    delay_between_groups    INTEGER NOT NULL DEFAULT 2,   -- em segundos
    delay_between_messages  INTEGER NOT NULL DEFAULT 10,  -- em segundos
    link_tracking_domains   TEXT,                         -- JSON array de domínios
    updated                 TEXT    NOT NULL              -- ISO datetime
);

-- Grupos
CREATE TABLE IF NOT EXISTS groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid   TEXT    NOT NULL UNIQUE,    -- ID do grupo no WhatsApp
    name        TEXT
);

-- Membros (contas WhatsApp)
CREATE TABLE IF NOT EXISTS members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_jid  TEXT NOT NULL UNIQUE
);

-- Associação membros ↔ grupos (N:N)
CREATE TABLE IF NOT EXISTS group_members (
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, member_id)
);

-- Mensagens (enfileiradas ou enviadas)
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    content         TEXT,                    -- texto da mensagem
    timestamp       TEXT  NOT NULL,          -- ISO datetime do envio
    original_jid    TEXT,                    -- id whatsapp da mensagem recebida
    sender_jid      TEXT,                    -- número de quem enviou
    image           BLOB                     -- imagem da mensagem
);

-- Números autorizados por bot (N:N)
CREATE TABLE IF NOT EXISTS authorized_numbers (
    bot_id     INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    wa_number  TEXT    NOT NULL,
    PRIMARY KEY (bot_id, wa_number)
);

-- Associação bots ↔ grupos (N:N)
CREATE TABLE IF NOT EXISTS bot_groups (
    bot_id     INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    broadcast  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bot_id, group_id)
);

-- Payloads originais usados para encaminhamento (1:1)
CREATE TABLE IF NOT EXISTS forward_payloads (
    message_id     INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    wa_message     TEXT    NOT NULL,         -- JSON completo da Baileys
    PRIMARY KEY (message_id)
);

-- Eventos de leitura de mensagem (N:N)
CREATE TABLE IF NOT EXISTS message_reads (
    message_id   INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    group_id     INTEGER REFERENCES groups(id), -- pode ser NULL
    timestamp    TEXT    NOT NULL,           -- ISO datetime do evento
    PRIMARY KEY (message_id, member_id, group_id, timestamp)
);

-- Eventos de entrada/saída de membros em grupos (N:N)
CREATE TABLE IF NOT EXISTS group_member_events (
    group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    event_type   TEXT    NOT NULL,           -- 'join' ou 'leave'
    timestamp    TEXT    NOT NULL,           -- ISO datetime do evento
    PRIMARY KEY (group_id, member_id, event_type, timestamp)
);

-- Mensagens enviadas para bots (N:N)
CREATE TABLE IF NOT EXISTS bot_messages (
    message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    bot_id      INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, bot_id)
);

-- Índices sugeridos para acelerar queries de estatísticas básicas:

-- Busca rápida dos grupos por bot
CREATE INDEX IF NOT EXISTS idx_bot_groups_bot_id ON bot_groups(bot_id);

-- Busca rápida dos bots por grupo (útil para reverso)
CREATE INDEX IF NOT EXISTS idx_bot_groups_group_id ON bot_groups(group_id);

-- Consulta eficiente dos membros por grupo
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);

-- Consulta eficiente de eventos de leitura por mensagem
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);

-- Consulta eficiente de eventos por grupo
CREATE INDEX IF NOT EXISTS idx_group_member_events_group_id ON group_member_events(group_id);

-- Consulta por número autorizado dentro de um bot específico (evita scan)
CREATE INDEX IF NOT EXISTS idx_authorized_numbers_bot_id ON authorized_numbers(bot_id);

-- Consulta de mensagens recebidas por remetente
CREATE INDEX IF NOT EXISTS idx_messages_sender_jid ON messages(sender_jid);

-- Consulta eficiente dos bots por mensagem
CREATE INDEX IF NOT EXISTS idx_message_bots_message_id ON bot_messages(message_id);

-- Consulta eficiente das mensagens por bot
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
