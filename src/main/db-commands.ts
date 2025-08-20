import database from "./db-connection";
import { BufferJSON } from "baileys/lib/Utils/generics.js";
import AppSettings from "../models/app-settings-model";
import { Group } from "../models/group-model";
import { Member } from "../models/member-model";
import { Message } from "../models/message-model";
import { Bot } from "../models/bot-model";
import {
  Status,
  WhatsAppSources,
  SendMethods,
  LinkParameters,
} from "../models/bot-options-model";
import { PlanStatus, PlanTier } from "../models/app-settings-options-model";
import { BotGroup } from "../models/bot-group";
import { AuthorizedNumber } from "../models/authorized-number-model";
import { GlobalStats } from "../models/global-stats";
import { logger } from "./logger";

function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows as T[]);
    });
  });
}

function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row as T | undefined);
    });
  });
}

function run(
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** TRANSACTION CONTROL **/

export function beginTransaction(): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run("BEGIN TRANSACTION", (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

export function commitTransaction(): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run("COMMIT", (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

export function rollbackTransaction(): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run("ROLLBACK", (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

/** APP_CONFIG **/

export async function getAppSettings(): Promise<AppSettings | null> {
  const sql = `
    SELECT
      id,
      license_key,
      dark_mode,
      user_id,
      plan_status,
      plan_tier,
      registered_bots,
      app_version,
      machine_id,
      last_ip,
      last_checkin,
      platform,
      last_sync,
      sync_interval
    FROM app_config
    WHERE id = 1
  `;
  return get<{
    id: number;
    license_key: string | null;
    dark_mode: number;
    user_id: string | null;
    plan_status: string;
    plan_tier: string;
    registered_bots: string;
    app_version: string;
    machine_id: string | null;
    last_ip: string | null;
    last_checkin: string;
    platform: string | null;
    last_sync: string;
    sync_interval: number;
  }>(sql).then((row) => {
    if (row) {
      const settings = new AppSettings();
      settings.LicenseKey = row.license_key;
      settings.DarkMode = !!row.dark_mode;
      settings.UserId = row.user_id;
      settings.PlanStatus = row.plan_status as PlanStatus;
      settings.PlanTier = row.plan_tier as PlanTier;
      try {
        settings.RegisteredBots = JSON.parse(row.registered_bots || "[]");
      } catch {
        settings.RegisteredBots = [];
      }
      settings.AppVersion = row.app_version;
      settings.MachineId = row.machine_id;
      settings.LastIP = row.last_ip;
      settings.LastCheckin = row.last_checkin;
      settings.Platform = row.platform || "";
      settings.LastSync = row.last_sync || "";
      settings.SyncInterval = row.sync_interval ?? 0;
      return settings;
    }
    return null;
  });
}

export async function updateAppSettings(settings: AppSettings): Promise<void> {
  const sql = `
    UPDATE app_config
       SET license_key = ?,
           dark_mode = ?,
           user_id = ?,
           plan_status = ?,
           plan_tier = ?,
           registered_bots = ?,
           app_version = ?,
           machine_id = ?,
           last_ip = ?,
           last_checkin = ?,
           platform = ?,
           last_sync = ?,
           sync_interval = ?
     WHERE id = 1
  `;
  await run(sql, [
    settings.LicenseKey,
    +settings.DarkMode,
    settings.UserId,
    settings.PlanStatus as string,
    settings.PlanTier as string,
    JSON.stringify(settings.RegisteredBots ?? []),
    settings.AppVersion,
    settings.MachineId,
    settings.LastIP,
    settings.LastCheckin,
    settings.Platform,
    settings.LastSync,
    settings.SyncInterval,
  ]);
}

/** GROUPS **/

export async function createGroup(group: Group): Promise<number> {
  const sql = `
    INSERT OR IGNORE INTO groups (group_jid, name, updated, invite_link)
    VALUES (?, ?, ?, ?)
  `;
  try {
    const { lastID, changes } = await run(sql, [
      group.GroupJid,
      group.Name,
      group.Updated ?? new Date().toISOString(),
      group.InviteLink ?? "",
    ]);
    return changes > 0 ? lastID : 0;
  } catch (error) {
    throw error;
  }
}

export async function updateGroup(group: Group): Promise<void> {
  const sql = `
    UPDATE groups
       SET group_jid = ?,
           name     = ?,
           updated  = ?,
           invite_link = ?
     WHERE id = ?
  `;
  await run(sql, [
    group.GroupJid,
    group.Name,
    group.Updated ?? new Date().toISOString(),
    group.InviteLink ?? "",
    group.Id,
  ]);
}

export async function markInviteLinksAsSynced(
  groupIds: number[]
): Promise<void> {
  if (groupIds.length === 0) {
    return;
  }
  const placeholders = groupIds.map(() => "?").join(",");
  const sql = `
    UPDATE groups
       SET invite_link = invite_link || ':sync'
     WHERE id IN (${placeholders})
  `;
  await run(sql, groupIds);
}

export async function deleteGroup(id: number): Promise<void> {
  const sql = `DELETE FROM groups WHERE id = ?`;
  await run(sql, [id]);
}

export async function getGroupById(id: number): Promise<Group | null> {
  const sql = `
    SELECT
      g.id,
      g.group_jid,
      g.name,
      g.updated,
      g.invite_link,
      COUNT(gm.member_id) AS total_members
    FROM groups AS g
    LEFT JOIN group_members AS gm
      ON gm.group_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `;
  return get<{
    id: number;
    group_jid: string;
    name: string;
    updated: string;
    invite_link: string;
    total_members: number;
  }>(sql, [id]).then((row) =>
    row
      ? new Group(
          row.id,
          row.group_jid,
          row.name,
          row.updated,
          row.invite_link,
          row.total_members,
          undefined
        )
      : null
  );
}

export async function getGroupIdByJid(
  groupJid: string
): Promise<number | null> {
  const sql = `
    SELECT
      g.id
    FROM groups AS g
    WHERE g.group_jid = ?
  `;
  return get<{ id: number }>(sql, [groupJid]).then((row) => row?.id ?? null);
}

export async function getAllGroups(): Promise<Group[]> {
  const sql = `
    SELECT
      g.id,
      g.group_jid,
      g.name,
      g.updated,
      g.invite_link,
      COUNT(gm.member_id) AS total_members
    FROM groups AS g
    LEFT JOIN group_members AS gm
      ON gm.group_id = g.id
    GROUP BY g.id
  `;
  return all<{
    id: number;
    group_jid: string;
    name: string;
    updated: string;
    invite_link: string;
    total_members: number;
  }>(sql).then((rows) =>
    rows.map(
      (r) =>
        new Group(
          r.id,
          r.group_jid,
          r.name,
          r.updated,
          r.invite_link,
          r.total_members,
          undefined
        )
    )
  );
}

export async function getGroupsByName(part: string): Promise<Group[]> {
  const sql = `
    SELECT
      g.id,
      g.group_jid,
      g.name,
      g.updated,
      g.invite_link,
      COUNT(gm.member_id) AS total_members
    FROM groups AS g
    LEFT JOIN group_members AS gm
      ON gm.group_id = g.id
    WHERE g.name LIKE ?
    GROUP BY g.id
  `;
  return all<{
    id: number;
    group_jid: string;
    name: string;
    updated: string;
    invite_link: string;
    total_members: number;
  }>(sql, [`%${part}%`]).then((rows) =>
    rows.map(
      (r) =>
        new Group(
          r.id,
          r.group_jid,
          r.name,
          r.updated,
          r.invite_link,
          r.total_members,
          undefined
        )
    )
  );
}

export async function getGroupsByBotId(botId: number): Promise<Group[]> {
  const sql = `
    SELECT
      g.id,
      g.group_jid,
      g.name,
      g.updated,
      g.invite_link,
      COUNT(gm.member_id) AS total_members,
      bg.broadcast
    FROM groups AS g
    JOIN bot_groups AS bg
      ON bg.group_id = g.id
      AND bg.bot_id = ?
    LEFT JOIN group_members AS gm
      ON gm.group_id = g.id
    GROUP BY g.id
  `;
  return all<{
    id: number;
    group_jid: string;
    name: string;
    updated: string;
    invite_link: string;
    total_members: number;
    broadcast: number;
  }>(sql, [botId]).then((rows) =>
    rows.map((r) => {
      const group = new Group(
        r.id,
        r.group_jid,
        r.name,
        r.updated,
        r.invite_link,
        r.total_members,
        !!r.broadcast
      );
      return group;
    })
  );
}

export async function getGroupsByMemberId(memberId: string): Promise<Group[]> {
  const sql = `
    SELECT
      g.id,
      g.group_jid,
      g.name,
      g.updated,
      g.invite_link,
      COUNT(gm_all.id) AS total_members
    FROM groups AS g
    JOIN group_members AS gm
      ON gm.group_id = g.id
      AND gm.member_id = ?
    LEFT JOIN group_members AS gm_all
      ON gm_all.group_id = g.id
    GROUP BY g.id
  `;
  return all<{
    id: number;
    group_jid: string;
    name: string;
    updated: string;
    invite_link: string;
    total_members: number;
  }>(sql, [memberId]).then((rows) =>
    rows.map(
      (r) =>
        new Group(
          r.id,
          r.group_jid,
          r.name,
          r.updated,
          r.invite_link,
          r.total_members,
          undefined
        )
    )
  );
}

/** MEMBERS **/

export async function getOrCreateMemberId(memberJid: string): Promise<number> {
  const row = await get<{ id: number }>(
    `SELECT id FROM members WHERE member_jid = ?`,
    [memberJid]
  );
  if (row) return row.id;
  const { lastID } = await run(`INSERT INTO members (member_jid) VALUES (?)`, [
    memberJid,
  ]);
  return lastID;
}

export async function getMemberByIdAndGroup(
  memberId: number,
  groupId: number
): Promise<Member | null> {
  const sql = `
    SELECT
      m.id,
      m.member_jid,
      gm.is_admin
    FROM group_members AS gm
    JOIN members AS m ON m.id = gm.member_id
    WHERE gm.member_id = ? AND gm.group_id = ?
    LIMIT 1
  `;
  const row = await get<{
    id: number;
    member_jid: string;
    is_admin: number;
  }>(sql, [memberId, groupId]);
  return row ? new Member(row.id, row.member_jid, !!row.is_admin) : null;
}

export async function getAllMembers(): Promise<Member[]> {
  const sql = `
    SELECT
      m.id,
      m.member_jid
    FROM members AS m
  `;
  const rows = await all<{
    id: number;
    member_jid: string;
  }>(sql);
  return rows.map((r) => new Member(r.id, r.member_jid));
}

export async function getMembersByGroupId(groupId: number): Promise<Member[]> {
  const sql = `
    SELECT
      m.id,
      m.member_jid,
      gm.is_admin
    FROM group_members AS gm
    JOIN members AS m ON m.id = gm.member_id
    WHERE gm.group_id = ?
    GROUP BY m.id, m.member_jid, gm.is_admin
  `;
  const rows = await all<{
    id: number;
    member_jid: string;
    is_admin: number;
  }>(sql, [groupId]);
  return rows.map((r) => new Member(r.id, r.member_jid, !!r.is_admin));
}

export async function updateGroupMemberAdmin(
  groupId: number,
  memberId: number,
  isAdmin: boolean
): Promise<void> {
  await run(
    `UPDATE group_members SET is_admin = ? WHERE group_id = ? AND member_id = ?`,
    [isAdmin ? 1 : 0, groupId, memberId]
  );
}

export async function deleteGroupMember(
  groupId: number,
  memberId: number
): Promise<void> {
  await run(`DELETE FROM group_members WHERE group_id = ? AND member_id = ?`, [
    groupId,
    memberId,
  ]);
}

/** MESSAGES **/

export async function createMessage(
  message: Message,
  botIds: number[]
): Promise<number> {
  const sql = `
    INSERT INTO messages
      (content, timestamp, original_jid, sender_jid, image)
    VALUES (?, ?, ?, ?, ?)
  `;
  const { lastID } = await run(sql, [
    message.Content,
    message.Timestamp,
    message.OriginalJid,
    message.SenderJid,
    message.Image ?? null,
  ]);
  if (botIds && botIds.length > 0) {
    await Promise.all(
      botIds.map((botId) =>
        run(`INSERT INTO bot_messages (message_id, bot_id) VALUES (?, ?)`, [
          lastID,
          botId,
        ])
      )
    );
  }
  return lastID;
}

export async function updateMessage(message: Message): Promise<void> {
  const sql = `
    UPDATE messages
       SET content = ?,
           timestamp = ?,
           original_jid = ?,
           sender_jid = ?,
           image = ?
     WHERE id = ?
  `;
  await run(sql, [
    message.Content,
    message.Timestamp,
    message.OriginalJid,
    message.SenderJid,
    message.Image ?? null,
    message.Id,
  ]);
}

export async function getMessageById(id: number): Promise<Message | null> {
  const sql = `
    SELECT
      m.id,
      m.content,
      m.timestamp,
      m.original_jid,
      m.sender_jid,
      m.image
    FROM messages AS m
    WHERE m.id = ?
  `;
  const row = await get<{
    id: number;
    content: string | null;
    timestamp: string;
    original_jid: string | null;
    sender_jid: string | null;
    image: Buffer | null;
  }>(sql, [id]);
  return row
    ? new Message(
        row.id,
        row.content,
        row.timestamp,
        row.original_jid,
        row.sender_jid,
        row.image,
        null,
        null
      )
    : null;
}

export async function getMessagesByPeriod(
  from: string,
  to: string,
  botId?: number
): Promise<Message[]> {
  let sql = `
    SELECT m.id, m.content, m.timestamp, m.original_jid, m.sender_jid
      FROM messages m
  `;
  const params: any[] = [from, to];

  if (typeof botId === "number") {
    sql += `
      INNER JOIN bot_messages bm ON bm.message_id = m.id
      WHERE m.timestamp >= ? AND m.timestamp <= ? AND bm.bot_id = ?
      ORDER BY m.timestamp DESC
    `;
    params.push(botId);
  } else {
    sql += `
      WHERE m.timestamp >= ? AND m.timestamp <= ?
      ORDER BY m.timestamp DESC
    `;
  }

  type MessageRow = {
    id: number;
    content: string | null;
    timestamp: string;
    original_jid: string | null;
    sender_jid: string | null;
  };
  const rows = await all<MessageRow>(sql, params);
  return rows.map(
    (row) =>
      new Message(
        row.id,
        row.content,
        row.timestamp,
        row.original_jid,
        row.sender_jid,
        null,
        null,
        null
      )
  );
}

/** BOTS **/

export async function createBot(bot: Bot): Promise<number> {
  const sql = `
    INSERT INTO bots (
      wa_number, campaign, whatsapp_sources, send_method, link_required, sending_report,
      delay_between_groups, delay_between_messages, link_parameters, updated, proxy
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const { lastID } = await run(sql, [
    bot.WaNumber || null,
    bot.Campaign,
    bot.WhatsAppSources,
    bot.SendMethod,
    +bot.LinkRequired,
    +bot.SendingReport,
    bot.DelayBetweenGroups,
    bot.DelayBetweenMessages,
    bot.LinkParameters,
    new Date().toISOString(),
    bot.Proxy || null,
  ]);
  if (bot.AuthorizedNumbers) {
    await syncAuthorizedNumbers(lastID, bot.AuthorizedNumbers);
  }
  return lastID;
}

export async function updateBot(bot: Bot): Promise<void> {
  const sql = `
    UPDATE bots
       SET wa_number = ?,
           campaign = ?,
           whatsapp_sources = ?,
           send_method = ?,
           link_required = ?,
           sending_report = ?,
           delay_between_groups = ?,
           delay_between_messages = ?,
           link_parameters = ?,
           updated = ?,
           proxy = ?
     WHERE id = ?
  `;
  await run(sql, [
    bot.WaNumber || null,
    bot.Campaign,
    bot.WhatsAppSources,
    bot.SendMethod,
    +bot.LinkRequired,
    +bot.SendingReport,
    bot.DelayBetweenGroups,
    bot.DelayBetweenMessages,
    bot.LinkParameters,
    new Date().toISOString(),
    bot.Proxy || null,
    bot.Id,
  ]);
  if (bot.AuthorizedNumbers) {
    await syncAuthorizedNumbers(bot.Id, bot.AuthorizedNumbers);
  }
}

export async function deleteBot(id: number): Promise<void> {
  const sql = `DELETE FROM bots WHERE id = ?`;
  await run(sql, [id]);
}

export async function getBotById(id: number): Promise<Bot | null> {
  const sql = `
    SELECT
      b.id,
      b.wa_number,
      b.campaign,
      b.whatsapp_sources,
      b.send_method,
      b.link_required,
      b.sending_report,
      b.delay_between_groups,
      b.delay_between_messages,
      b.link_parameters,
      b.updated,
      b.proxy,
      COALESCE(bg.count_groups, 0) AS total_groups,
      GROUP_CONCAT(an.wa_number) AS authorized_numbers
    FROM bots AS b
    LEFT JOIN (
      SELECT bot_id, COUNT(*) AS count_groups
      FROM bot_groups
      GROUP BY bot_id
    ) AS bg ON bg.bot_id = b.id
    LEFT JOIN authorized_numbers an ON an.bot_id = b.id
    WHERE b.id = ?
    GROUP BY b.id
  `;
  const row = await get<{
    id: number;
    wa_number: string;
    campaign: string | null;
    whatsapp_sources: string;
    send_method: string;
    link_required: number;
    sending_report: number;
    delay_between_groups: number;
    delay_between_messages: number;
    link_parameters: string | null;
    updated: string;
    proxy: string | null;
    total_groups: number;
    authorized_numbers: string | null;
  }>(sql, [id]);
  const authorizedNumbers: string[] = row?.authorized_numbers
    ? row.authorized_numbers.split(",")
    : [];
  return row
    ? new Bot(
        row.id,
        row.wa_number,
        row.campaign,
        row.whatsapp_sources as WhatsAppSources,
        row.send_method as SendMethods,
        !!row.link_required,
        !!row.sending_report,
        row.delay_between_groups,
        row.delay_between_messages,
        row.link_parameters as LinkParameters,
        row.updated,
        row.proxy,
        false,
        authorizedNumbers,
        false,
        Status.Offline,
        row.total_groups
      )
    : null;
}

export async function getAllBots(): Promise<Bot[]> {
  const sql = `
    SELECT
      b.id,
      b.wa_number,
      b.campaign,
      b.whatsapp_sources,
      b.send_method,
      b.link_required,
      b.sending_report,
      b.delay_between_groups,
      b.delay_between_messages,
      b.link_parameters,
      b.updated,
      b.proxy,
      COALESCE(bg.count_groups, 0) AS total_groups,
      GROUP_CONCAT(an.wa_number) AS authorized_numbers
    FROM bots AS b
    LEFT JOIN (
      SELECT bot_id, COUNT(*) AS count_groups
      FROM bot_groups
      GROUP BY bot_id
    ) AS bg ON bg.bot_id = b.id
    LEFT JOIN authorized_numbers an ON an.bot_id = b.id
    GROUP BY b.id
  `;
  const rows = await all<{
    id: number;
    wa_number: string;
    campaign: string | null;
    whatsapp_sources: string;
    send_method: string;
    link_required: number;
    sending_report: number;
    delay_between_groups: number;
    delay_between_messages: number;
    link_parameters: string | null;
    updated: string;
    proxy: string | null;
    total_groups: number;
    authorized_numbers: string | null;
  }>(sql);
  return rows.map((row) => {
    const authorizedNumbers: string[] = row.authorized_numbers
      ? row.authorized_numbers.split(",")
      : [];
    return new Bot(
      row.id,
      row.wa_number,
      row.campaign,
      row.whatsapp_sources as WhatsAppSources,
      row.send_method as SendMethods,
      !!row.link_required,
      !!row.sending_report,
      row.delay_between_groups,
      row.delay_between_messages,
      row.link_parameters as LinkParameters,
      row.updated,
      row.proxy,
      false,
      authorizedNumbers,
      false,
      Status.Offline,
      row.total_groups
    );
  });
}

/** AUTHORIZED_NUMBERS **/

export async function createAuthorizedNumber(
  botId: number,
  number: string
): Promise<void> {
  const sql = `
    INSERT OR IGNORE INTO authorized_numbers (bot_id, wa_number)
    VALUES (?, ?)
  `;
  await run(sql, [botId, number]);
}

export async function getAuthorizedNumbers(
  botId?: number
): Promise<AuthorizedNumber[]> {
  let sql = `SELECT bot_id, wa_number FROM authorized_numbers`;
  const params: any[] = [];
  if (typeof botId === "number") {
    sql += ` WHERE bot_id = ?`;
    params.push(botId);
  }
  const rows = await all<{ bot_id: number; wa_number: string }>(sql, params);
  return rows.map((r) => new AuthorizedNumber(r.bot_id, r.wa_number));
}

export async function syncAuthorizedNumbers(
  botId: number,
  numbers: string[]
): Promise<void> {
  const currentRows = await all<{ wa_number: string }>(
    `SELECT wa_number FROM authorized_numbers WHERE bot_id = ?`,
    [botId]
  );
  const current = new Set(currentRows.map((r) => r.wa_number));
  const incoming = new Set(numbers);

  const toRemove = [...current].filter((n) => !incoming.has(n));
  const toAdd = [...incoming].filter((n) => !current.has(n));

  if (toRemove.length > 0) {
    await Promise.all(
      toRemove.map((num) =>
        run(
          `DELETE FROM authorized_numbers WHERE bot_id = ? AND wa_number = ?`,
          [botId, num]
        )
      )
    );
  }

  if (toAdd.length > 0) {
    await Promise.all(
      toAdd.map((num) =>
        run(
          `INSERT INTO authorized_numbers (bot_id, wa_number) VALUES (?, ?)`,
          [botId, num]
        )
      )
    );
  }
}

/** BOT_GROUPS **/

export async function createBotGroup(
  botId: number,
  groupId: number,
  broadcast: number
): Promise<number> {
  const sql = `
    INSERT OR IGNORE INTO bot_groups (bot_id, group_id, broadcast)
    VALUES (?, ?, ?)
  `;
  try {
    const { lastID, changes } = await run(sql, [botId, groupId, broadcast]);
    return changes > 0 ? lastID : 0;
  } catch (error) {
    throw error;
  }
}

export async function getBotGroupsByBotId(botId: number): Promise<BotGroup[]> {
  const sql = `
    SELECT
      bg.bot_id,
      bg.broadcast,
      g.id AS group_id,
      g.name,
      COUNT(gm.member_id) AS members
    FROM bot_groups AS bg
    JOIN groups AS g ON g.id = bg.group_id
    LEFT JOIN group_members AS gm ON gm.group_id = g.id
    WHERE bg.bot_id = ?
    GROUP BY bg.bot_id, bg.broadcast, g.id, g.name
    ORDER BY g.name
  `;
  return all<{
    bot_id: number;
    broadcast: number;
    group_id: number;
    members: number;
    name: string;
  }>(sql, [botId]).then((rows) =>
    rows.map(
      (r) =>
        new BotGroup(r.bot_id, !!r.broadcast, r.group_id, r.members, r.name)
    )
  );
}

export async function updateBotGroupsBroadcast(
  botId: number,
  groups: BotGroup[]
): Promise<void> {
  const updates = groups.map((g) =>
    run(
      `UPDATE bot_groups SET broadcast = ? WHERE bot_id = ? AND group_id = ?`,
      [g.Broadcast ? 1 : 0, botId, g.GroupId]
    )
  );
  await Promise.all(updates);
}

export async function deleteBotGroup(
  botId: number,
  groupId: number
): Promise<void> {
  await run(`DELETE FROM bot_groups WHERE bot_id = ? AND group_id = ?`, [
    botId,
    groupId,
  ]);
}

/** GROUP_MEMBERS **/

export async function createGroupMember(
  groupId: number,
  memberId: number,
  isAdmin: boolean
): Promise<number> {
  const sql = `
    INSERT OR IGNORE INTO group_members (group_id, member_id, is_admin)
    VALUES (?, ?, ?)
  `;
  const { lastID, changes } = await run(sql, [
    groupId,
    memberId,
    isAdmin ? 1 : 0,
  ]);
  return changes > 0 ? lastID : 0;
}

export async function purgeOldMessages(): Promise<number> {
  const cutoff30 = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { changes } = await run(`DELETE FROM messages WHERE timestamp < ?`, [
    cutoff30,
  ]);

  const updateResult = await run(
    `UPDATE messages SET image = NULL WHERE timestamp < ? AND image IS NOT NULL`,
    [cutoff7]
  );

  if (updateResult.changes > 0) {
    try {
      await run(`VACUUM`);
    } catch (error) {
      console.error("❌ Error running VACUUM:", error);
      logger.error("❌ Error running VACUUM:", error);
    }
  }

  return changes;
}

export async function deleteOrphanMembers(): Promise<void> {
  await run(`
    DELETE FROM members
    WHERE id NOT IN (SELECT DISTINCT member_id FROM group_members)
  `);
}

export async function deleteOrphanGroups(): Promise<void> {
  await run(`
    DELETE FROM groups
    WHERE id NOT IN (SELECT DISTINCT group_id FROM bot_groups)
  `);
}

/** BOT GROUPS & MEMBERS STATS **/
export async function getBotGroupsAndMembers(botId: number): Promise<{
  totalGroups: number;
  totalMembers: number;
  broadcastGroups: number;
  broadcastMembers: number;
}> {
  const row = await get<{
    totalGroups: number;
    totalMembers: number;
    broadcastGroups: number;
    broadcastMembers: number;
  }>(
    `
    SELECT
      COUNT(DISTINCT g.id) AS totalGroups,
      COUNT(DISTINCT gm.member_id) AS totalMembers,
      COUNT(DISTINCT CASE WHEN bg.broadcast = 1 THEN g.id END) AS broadcastGroups,
      COUNT(DISTINCT CASE WHEN bg.broadcast = 1 THEN gm.member_id END) AS broadcastMembers
    FROM bot_groups bg
    JOIN groups g ON g.id = bg.group_id
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE bg.bot_id = ?
    `,
    [botId]
  );

  return {
    totalGroups: row?.totalGroups || 0,
    totalMembers: row?.totalMembers || 0,
    broadcastGroups: row?.broadcastGroups || 0,
    broadcastMembers: row?.broadcastMembers || 0,
  };
}

export async function getGlobalStats(
  startOfMonth: string,
  startOfWeek: string,
  startOfToday: string
): Promise<GlobalStats> {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM bots) as totalBots,
      (SELECT COUNT(*) FROM groups) as totalGroups,
      (SELECT COUNT(DISTINCT group_id) FROM bot_groups WHERE broadcast = 1) as broadcastGroups,
      (SELECT COUNT(DISTINCT member_id) FROM group_members) as totalMembers,
      (SELECT COUNT(DISTINCT gm.member_id)
         FROM group_members gm
         JOIN bot_groups bg ON gm.group_id = bg.group_id
        WHERE bg.broadcast = 1) as broadcastMembers,
      (SELECT COUNT(*) FROM messages) as totalMessages,
      (SELECT COUNT(*) FROM messages WHERE timestamp >= ?) as monthMessages,
      (SELECT COUNT(*) FROM messages WHERE timestamp >= ?) as weekMessages,
      (SELECT COUNT(*) FROM messages WHERE timestamp >= ?) as todayMessages
  `;

  const row = await get<GlobalStats>(sql, [
    startOfMonth,
    startOfWeek,
    startOfToday,
  ]);

  return (
    row || {
      totalBots: 0,
      totalGroups: 0,
      broadcastGroups: 0,
      totalMembers: 0,
      broadcastMembers: 0,
      totalMessages: 0,
      monthMessages: 0,
      weekMessages: 0,
      todayMessages: 0,
    }
  );
}

export async function getDatabaseBackup(): Promise<{
  Bots: any[];
  AuthorizedNumbers: any[];
  Groups: number;
  BotGroups: number;
  Members: number;
  Messages: number;
}> {
  const bots = await all<{
    id: number;
    wa_number: string;
    campaign: string | null;
    whatsapp_sources: string;
    link_required: number;
    send_method: string;
    delay_between_groups: number;
    delay_between_messages: number;
    link_parameters: string | null;
    updated: string;
    proxy: boolean;
  }>(
    `SELECT 
      id, 
      wa_number, 
      campaign, 
      whatsapp_sources, 
      link_required,
      send_method, 
      delay_between_groups, 
      delay_between_messages, 
      link_parameters, 
      updated, 
      CASE WHEN proxy IS NOT NULL AND proxy != '' THEN 1 ELSE 0 END AS proxy 
    FROM bots`
  );
  const authorizedNumbers = await all<any>(`SELECT * FROM authorized_numbers`);
  const [{ count: Groups }] = await all<{ count: number }>(
    `SELECT COUNT(*) as count FROM groups`
  );
  const [{ count: BotGroups }] = await all<{ count: number }>(
    `SELECT COUNT(*) as count FROM bot_groups WHERE broadcast = 1`
  );
  const [{ count: Members }] = await all<{ count: number }>(
    `SELECT COUNT(*) as count FROM members`
  );
  const [{ count: Messages }] = await all<{ count: number }>(
    `SELECT COUNT(*) as count FROM messages`
  );

  return {
    Bots: bots.map((b) => ({ ...b, link_required: !!b.link_required })),
    AuthorizedNumbers: authorizedNumbers,
    Groups,
    BotGroups,
    Members,
    Messages,
  };
}

/** AUTH STATE em JSON bruto **/
export async function getAuthState(botId: number): Promise<string | null> {
  const row = await get<{ auth: string }>(
    `SELECT auth FROM bots WHERE id = ?`,
    [botId]
  );
  return row?.auth ?? null;
}

export async function updateAuthState(
  botId: number,
  auth: string
): Promise<void> {
  await run(`UPDATE bots SET auth = ? WHERE id = ?`, [auth, botId]);
}

export async function clearAuthState(botId: number): Promise<void> {
  await run(`UPDATE bots SET auth = NULL WHERE id = ?`, [botId]);
  await run(`DELETE FROM bot_keys WHERE bot_id = ?`, [botId]);
}

export async function getAuthKeys(
  botId: number,
  category: string,
  ids: string[]
): Promise<Record<string, any>> {
  const placeholders = ids.map(() => "?").join(",");
  const rows = await all<{ key_id: string; value_json: string }>(
    `SELECT key_id, value_json FROM bot_keys
     WHERE bot_id = ? AND category = ? AND key_id IN (${placeholders})`,
    [botId, category, ...ids]
  );
  const result: Record<string, any> = {};
  for (const { key_id, value_json } of rows) {
    result[key_id] = JSON.parse(value_json, BufferJSON.reviver);
  }
  return result;
}

export async function upsertAuthKey(
  botId: number,
  category: string,
  keyId: string,
  value: any
): Promise<void> {
  await run(
    `INSERT INTO bot_keys(bot_id,category,key_id,value_json)
     VALUES(?,?,?,?)
     ON CONFLICT(bot_id,category,key_id) DO UPDATE SET value_json=excluded.value_json`,
    [botId, category, keyId, JSON.stringify(value, BufferJSON.replacer)]
  );
}

export async function deleteAuthKey(
  botId: number,
  category: string,
  keyId: string
): Promise<void> {
  await run(
    `DELETE FROM bot_keys WHERE bot_id = ? AND category = ? AND key_id = ?`,
    [botId, category, keyId]
  );
}

export async function getTotalMessagesToday(botId: number): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoToday = today.toISOString();

  const row = await get<{ total: number }>(
    `
    SELECT COUNT(*) as total
    FROM messages m
    INNER JOIN bot_messages bm ON bm.message_id = m.id
    WHERE m.timestamp >= ? AND bm.bot_id = ?
    `,
    [isoToday, botId]
  );
  return row?.total ?? 0;
}
