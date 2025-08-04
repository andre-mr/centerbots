import {
  makeWASocket,
  AuthenticationState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  AuthenticationCreds,
  downloadMediaMessage,
  GroupMetadata,
} from "baileys";
import { initAuthCreds } from "baileys/lib/Utils/auth-utils.js";
// import { Browsers, BufferJSON } from "baileys/lib/Utils/generics.js";
import { BufferJSON } from "baileys/lib/Utils/generics.js";
import { Bot } from "../models/bot-model";
import {
  Status,
  WhatsAppSources,
  SendMethods,
  LinkParameters,
} from "../models/bot-options-model";
import {
  getAllBots,
  updateBot,
  getBotGroupsAndMembers,
  getAuthorizedNumbers,
  getGroupsByBotId,
  getMembersByGroupId,
  createGroup,
  updateGroup,
  createBotGroup,
  getOrCreateMemberId,
  createGroupMember,
  updateGroupMemberAdmin,
  deleteGroupMember,
  deleteBotGroup,
  createMessage,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getAuthState,
  updateAuthState,
  getAuthKeys,
  upsertAuthKey,
  deleteAuthKey,
  clearAuthState,
  deleteOrphanMembers,
  deleteOrphanGroups,
  getGroupIdByJid,
  getTotalMessagesToday,
  getGroupById,
} from "./db-commands";
import pino from "pino";
import { Message } from "../models/message-model";
import { AuthorizedNumber } from "../models/authorized-number-model";
import { Group } from "../models/group-model";
import metadata from "url-metadata";
import sharp from "sharp";
import { HttpsProxyAgent } from "https-proxy-agent";
import { PlanTier } from "../models/app-settings-options-model";
import AppSettings from "../models/app-settings-model";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BotInstance = {
  bot: Bot;
  socket: ReturnType<typeof makeWASocket> | null;
  messageQueue: Message[];
  groupMetadataCache: Record<string, any> | null;
  broadcastGroupJids: Set<string> | null;
  authorizedNumbers: AuthorizedNumber[];
  lastGroupFetch: number | null;
  reconnectAttempts: number;
  manualDisconnect: boolean;
  isConnecting: boolean;
  isSyncingGroups: boolean;
  stop: (() => Promise<void>) | null;
  sentCount: number;
  inviteLinksFetched?: boolean;
};

type BotQueueState = {
  paused: boolean;
  sending: boolean;
  currentMessageIndex: number;
  currentGroupIndex: number;
};

/* -------------------------------------------------------------------------- */
/*                                 WaManager                                  */
/* -------------------------------------------------------------------------- */

export class WaManager {
  public mainWindow: Electron.BrowserWindow;
  public bots: Map<number, BotInstance> = new Map();
  public botQueueStates: Map<number, BotQueueState> = new Map();
  private syncLock: boolean = false;
  public appSettings: AppSettings | null = null;

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /* ---------------------------- register and init --------------------------- */

  async registerBot(bot: Bot) {
    const authorizedNumbers = await getAuthorizedNumbers(bot.Id);

    if (!this.bots.has(bot.Id)) {
      this.bots.set(bot.Id, {
        bot,
        socket: null,
        messageQueue: [],
        stop: null,
        authorizedNumbers,
        manualDisconnect: false,
        isConnecting: false,
        isSyncingGroups: false,
        groupMetadataCache: null,
        lastGroupFetch: null,
        broadcastGroupJids: null,
        reconnectAttempts: 0,
        sentCount: 0,
      });
    } else {
      const instance = this.bots.get(bot.Id)!;
      instance.bot = bot;
      instance.authorizedNumbers = authorizedNumbers;
    }
  }

  async init() {
    const bots = await getAllBots();
    for (const bot of bots) {
      await this.registerBot(bot);

      const stats = await getBotGroupsAndMembers(bot.Id);
      this.mainWindow.webContents.send("bot:groupsAndMembersStatsUpdate", {
        botId: bot.Id,
        stats: {
          broadcastGroups: stats.broadcastGroups,
          broadcastMembers: stats.broadcastMembers,
        },
      });
      this.mainWindow.webContents.send("bot:messageQueueUpdate", {
        botId: bot.Id,
        messageQueue: this.bots.get(bot.Id)?.messageQueue || [],
      });
    }
  }

  async syncBotGroupsAndMembers(
    botId: number,
    serverGroupsMetadata: Record<string, any>,
    attempt: number = 1
  ) {
    const MAX_ATTEMPTS = 100;
    if (this.syncLock) {
      if (attempt > MAX_ATTEMPTS) {
        return;
      }
      const delayMs = 1000 + Math.floor(Math.random() * 5000);
      setTimeout(
        () =>
          this.syncBotGroupsAndMembers(
            botId,
            serverGroupsMetadata,
            attempt + 1
          ),
        delayMs
      );
      return;
    }

    this.syncLock = true;
    try {
      await beginTransaction();
      const serverGroupJids = new Set(Object.keys(serverGroupsMetadata));
      const localGroups = await getGroupsByBotId(botId);

      for (const groupJid of serverGroupJids) {
        const meta = serverGroupsMetadata[groupJid];
        let groupId: number;
        const localGroup = localGroups.find((g) => g.GroupJid === groupJid);
        const nowIso = new Date().toISOString();

        let shouldUpdateGroup = false;
        let localMembers: any[] = [];

        if (!localGroup) {
          groupId = await createGroup(
            new Group(0, groupJid, meta.subject, nowIso, "", meta.size)
          );
          if (!groupId) {
            const existingId = await getGroupIdByJid(groupJid);
            if (!existingId) {
              await commitTransaction();
              await this.updateBotGroupsAndMembersStats(botId);
              return;
            }
            groupId = existingId;
          }
        } else {
          groupId = localGroup.Id;
          localMembers = await getMembersByGroupId(groupId);

          if (localGroup.Name !== meta.subject) {
            shouldUpdateGroup = true;
          }
        }

        if (groupId > 0) {
          await createBotGroup(botId, groupId, 0);
        } else {
          await commitTransaction();
          await this.updateBotGroupsAndMembersStats(botId);
          return;
        }

        if (!localMembers.length && localGroup) {
          localMembers = await getMembersByGroupId(groupId);
        }
        const serverMemberJids = new Set(
          meta.participants.map((p: any) => p.id)
        );

        const localMembersMap = new Map(
          localMembers.map((m) => [m.MemberJid, m])
        );

        for (const p of meta.participants) {
          const serverIsAdmin = p.admin ? true : false;
          const localMember = localMembersMap.get(p.id);

          if (!localMember) {
            shouldUpdateGroup = true;
            const memberId = await getOrCreateMemberId(p.id);
            await createGroupMember(groupId, memberId, serverIsAdmin);
          } else {
            if (localMember.IsAdmin !== serverIsAdmin) {
              const memberId = await getOrCreateMemberId(p.id);
              await updateGroupMemberAdmin(groupId, memberId, serverIsAdmin);
            }
          }
        }

        for (const local of localMembers) {
          if (!serverMemberJids.has(local.MemberJid)) {
            shouldUpdateGroup = true;
            await deleteGroupMember(groupId, local.Id);
          }
        }
        await deleteOrphanMembers();

        if (shouldUpdateGroup && localGroup) {
          await updateGroup(
            new Group(groupId, groupJid, meta.subject, nowIso, "", meta.size)
          );
        }
      }

      for (const local of localGroups) {
        if (!serverGroupJids.has(local.GroupJid)) {
          await deleteBotGroup(botId, local.Id);
        }
      }
      await deleteOrphanGroups();
      await commitTransaction();

      if (
        localGroups.length > 0 &&
        this.appSettings?.PlanTier === PlanTier.Enterprise
      ) {
        let currentBot = this.bots.get(botId);
        if (currentBot?.socket && !currentBot.inviteLinksFetched) {
          currentBot.inviteLinksFetched = true;
          getInviteLinks(
            currentBot.socket,
            currentBot.bot.WaNumber,
            localGroups,
            serverGroupsMetadata
          );
        }
      }

      await this.updateBotGroupsAndMembersStats(botId);
    } catch (error) {
      console.error(
        "❌ Error during group sync, rolling back transaction:",
        error
      );
      await rollbackTransaction();
      throw error;
    } finally {
      this.syncLock = false;
    }
  }

  async handleGroupUpsert(botId: number, group: GroupMetadata) {
    this.syncLock = true;
    try {
      await beginTransaction();
      const nowIso = new Date().toISOString();
      const groupId = await createGroup(
        new Group(
          0,
          group.id,
          group.subject,
          nowIso,
          "",
          group.participants.length
        )
      );
      if (groupId > 0) {
        await createBotGroup(botId, groupId, 0);
        for (const p of group.participants) {
          const memberId = await getOrCreateMemberId(p.id);
          await createGroupMember(groupId, memberId, !!p.admin);
        }
      }
      await commitTransaction();
      await this.updateBotGroupsAndMembersStats(botId);
    } catch (error) {
      console.error("❌ Error during handleGroupUpsert, rolling back:", error);
      await rollbackTransaction();
    } finally {
      this.syncLock = false;
    }
  }

  async handleGroupMetadataUpdate(
    botId: number,
    update: Partial<GroupMetadata>
  ) {
    this.syncLock = true;
    try {
      const groupId = await getGroupIdByJid(update.id!);
      if (groupId) {
        const nowIso = new Date().toISOString();
        await updateGroup(
          new Group(
            groupId,
            update.id!,
            update.subject!,
            nowIso,
            "",
            update.size!
          )
        );
        await this.updateBotGroupsAndMembersStats(botId);
      }
    } catch (error) {
      console.error("❌ Error during handleGroupMetadataUpdate:", error);
    } finally {
      this.syncLock = false;
    }
  }

  async handleBotLeftGroup(botId: number, groupId: number) {
    this.syncLock = true;
    try {
      await deleteBotGroup(botId, groupId);
      await deleteOrphanGroups();
      await deleteOrphanMembers();
      await this.updateBotGroupsAndMembersStats(botId);
    } catch (error) {
      console.error("❌ Error during handleBotLeftGroup:", error);
    } finally {
      this.syncLock = false;
    }
  }

  async handleGroupParticipantsUpdate(
    botId: number,
    update: { id: string; action: string; participants: string[] }
  ) {
    this.syncLock = true;
    try {
      await beginTransaction();
      const groupId = await getGroupIdByJid(update.id);
      if (!groupId) {
        await rollbackTransaction();
        return;
      }

      let shouldUpdateGroup = false;

      for (const pJid of update.participants) {
        if (update.action === "add") {
          const memberId = await getOrCreateMemberId(pJid);
          await createGroupMember(groupId, memberId, false);
        } else if (update.action === "remove") {
          const memberId = await getOrCreateMemberId(pJid);
          await deleteGroupMember(groupId, memberId);
          shouldUpdateGroup = true;
        } else if (update.action === "promote" || update.action === "demote") {
          const memberId = await getOrCreateMemberId(pJid);
          await updateGroupMemberAdmin(
            groupId,
            memberId,
            update.action === "promote"
          );
        }
      }

      if (update.action === "remove") {
        await deleteOrphanMembers();
      }

      if (shouldUpdateGroup) {
        const group = await getGroupById(groupId);
        if (group) {
          group.Updated = new Date().toISOString();
          await updateGroup(group);
        }
      }

      await commitTransaction();
      await this.updateBotGroupsAndMembersStats(botId);
    } catch (error) {
      console.error(
        "❌ Error during handleGroupParticipantsUpdate, rolling back:",
        error
      );
      await rollbackTransaction();
    } finally {
      this.syncLock = false;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            BOT START / STOP                                */
  /* -------------------------------------------------------------------------- */

  async startBot(bot: Bot) {
    const botInstance = this.bots.get(bot.Id);
    if (!botInstance) return;

    if (botInstance.socket) {
      try {
        botInstance.socket.end(new Error("restarting"));
      } catch (error) {
        console.error("❌ Error while ending the previous socket:", error);
      }
      botInstance.socket = null;
    }

    if (botInstance.isConnecting) return;
    botInstance.isConnecting = true;
    botInstance.manualDisconnect = false;

    const { version } = await fetchLatestBaileysVersion();

    /* ------------------------------ proxy agent ----------------------------- */
    let proxyAgent: HttpsProxyAgent<string> | null = null;
    if (bot.Proxy) {
      proxyAgent = new HttpsProxyAgent(bot.Proxy);
    }

    /* --------------------------- load credentials -------------------------- */
    const raw = await getAuthState(bot.Id);
    let auth: AuthenticationState;

    if (raw) {
      const parsed = JSON.parse(raw, BufferJSON.reviver);
      auth = {
        creds: parsed.creds,
        keys: {
          get: async (category, ids) => getAuthKeys(bot.Id, category, ids),
          set: async (data) => {
            for (const cat in data) {
              for (const id in data[cat]) {
                const value = data[cat][id];
                if (value) {
                  await upsertAuthKey(bot.Id, cat, id, value);
                } else {
                  await deleteAuthKey(bot.Id, cat, id);
                }
              }
            }
          },
        },
      };
    } else {
      auth = {
        creds: initAuthCreds(),
        keys: { get: async () => ({}), set: async () => {} },
      };
    }

    /* ---------------------------- create socket ---------------------------- */
    const sock = makeWASocket({
      version,
      auth,
      printQRInTerminal: false,
      logger: pino({ level: "error" }),
      cachedGroupMetadata: async (jid) => botInstance.groupMetadataCache?.[jid],
      generateHighQualityLinkPreview: false,
      agent: (proxyAgent as any) || undefined,
      shouldSyncHistoryMessage: () => false,
      // browser: Browsers.windows("Edge"),
      // browser: Browsers.windows("Chrome"),
    });
    sock.groupInviteCode;
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      const instance = this.bots.get(bot.Id);
      if (!instance) return;

      if (qr) {
        this.mainWindow.webContents.send("bot:qrCode", { botId: bot.Id, qr });
        bot.Status = Status.LoggedOut;
        this.mainWindow.webContents.send("bot:statusUpdate", bot);
      } else {
        this.mainWindow.webContents.send("bot:qrCode", {
          botId: bot.Id,
          qr: "",
        });
      }

      /* ------------------------------- CONNECTED ------------------------------ */
      if (connection === "open") {
        instance.isConnecting = false;
        instance.reconnectAttempts = 0;

        auth.creds.me = {
          id: sock.user!.id,
          name: sock.user!.name || bot.Campaign || "User",
        };
        await updateAuthState(
          bot.Id,
          JSON.stringify(auth, BufferJSON.replacer)
        );

        if (bot.Active) {
          bot.Status = Status.Online;
          this.mainWindow.webContents.send("bot:statusUpdate", bot);
        } else {
          await this.stopBotInstance(bot.Id);
          return;
        }

        /* ------------ cache and sync groups (max once/10min) ------------ */
        const now = Date.now();
        if (
          !instance.lastGroupFetch ||
          now - instance.lastGroupFetch > 600_000
        ) {
          instance.isSyncingGroups = true;
          try {
            let groupMetadataCache = await sock.groupFetchAllParticipating();
            groupMetadataCache = Object.fromEntries(
              Object.entries(groupMetadataCache).sort(([, a], [, b]) =>
                (a.subject || "")
                  .toLowerCase()
                  .localeCompare((b.subject || "").toLowerCase())
              )
            );
            instance.groupMetadataCache = groupMetadataCache;
            instance.lastGroupFetch = now;
            await this.syncBotGroupsAndMembers(bot.Id, groupMetadataCache);
          } finally {
            instance.isSyncingGroups = false;
          }
        }

        const state = this.botQueueStates.get(bot.Id);
        if (state && !state.paused) {
          this.processQueue(bot.Id);
        }
      }

      /* ------------------------------ DISCONNECTED ----------------------------- */
      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          await clearAuthState(bot.Id);
          bot.Status = Status.LoggedOut;
        } else {
          bot.Status = Status.Disconnected;
        }

        this.mainWindow.webContents.send("bot:statusUpdate", bot);
        instance.isConnecting = false;
        instance.socket = null;

        if (!instance.manualDisconnect && bot.Active && shouldReconnect) {
          instance.reconnectAttempts += 1;
          const backoff =
            instance.reconnectAttempts > 5
              ? 60_000
              : Math.min(instance.reconnectAttempts, 5) * 5_000;
          setTimeout(() => this.startBot(bot), backoff);
        }
      }
    });

    /* ----------------------------- creds.update ----------------------------- */
    sock.ev.on("creds.update", async (partialCreds) => {
      const instance = this.bots.get(bot.Id);
      if (!instance?.bot.Active) return;

      auth.creds = { ...auth.creds, ...partialCreds } as AuthenticationCreds;
      await updateAuthState(bot.Id, JSON.stringify(auth, BufferJSON.replacer));

      const userNumber = sock.user?.id?.match(/^\d+/)?.[0];
      if (userNumber && bot.WaNumber !== userNumber) {
        bot.WaNumber = userNumber;
        updateBot(bot);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      const botInstance = this.bots.get(bot.Id);
      if (!botInstance?.bot.Active) {
        return;
      }

      for (const msg of messages) {
        let sender = "";
        if (msg.key?.remoteJid?.endsWith("s.whatsapp.net")) {
          sender = msg.key.remoteJid;
        } else if (
          msg.key?.remoteJid?.endsWith("g.us") &&
          msg.key.participant?.endsWith("s.whatsapp.net")
        ) {
          sender = msg.key.participant;
        }

        setTimeout(
          () => {
            sock.readMessages([
              {
                remoteJid: msg.key.remoteJid,
                id: msg.key.id,
                participant:
                  msg?.participant || msg?.key?.participant || undefined,
              },
            ]);
          },
          Math.floor(Math.random() * 1000) + 1000
        );

        if (
          msg.key.fromMe ||
          !sender ||
          !botInstance.authorizedNumbers.some((authorizedNumber) =>
            sender.includes(authorizedNumber.WaNumber)
          )
        ) {
          continue;
        }

        const content =
          msg.message?.conversation ||
          msg?.message?.extendedTextMessage?.text ||
          msg?.message?.ephemeralMessage?.message?.conversation ||
          msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
          msg?.message?.imageMessage?.caption ||
          msg?.message?.videoMessage?.caption ||
          msg?.message?.ephemeralMessage?.message?.imageMessage?.caption ||
          msg?.message?.ephemeralMessage?.message?.videoMessage?.caption;

        if (
          typeof content === "string" &&
          content.trim().toLowerCase() === "status" &&
          msg.key?.remoteJid?.endsWith("s.whatsapp.net")
        ) {
          const statusTranslated =
            bot.Status === Status.Online
              ? "Online"
              : bot.Status === Status.Sending
                ? "Enviando"
                : bot.Status === Status.Disconnected
                  ? "Desconectado"
                  : bot.Status === Status.LoggedOut
                    ? "Deslogado"
                    : bot.Status === Status.Offline
                      ? "Offline"
                      : "Indefinido";

          const totalToday = await getTotalMessagesToday(bot.Id);

          const replyMessage =
            `${bot.Status === Status.Online ? "🟢" : bot.Status === Status.Sending ? "🟡" : "⚪"} ` +
            `Bot está ${statusTranslated}\n` +
            `${botInstance?.messageQueue.length ?? 0} mensagens na fila\n` +
            `${totalToday} enviadas hoje`;

          setTimeout(
            () => {
              sock.sendMessage(
                sender,
                { text: replyMessage },
                {
                  quoted: msg,
                  ephemeralExpiration:
                    msg.message?.extendedTextMessage?.contextInfo?.expiration ||
                    undefined,
                }
              );
            },
            Math.floor(Math.random() * 1000) + 1000
          );
          continue;
        }

        if (
          !content ||
          (bot.LinkRequired && !/https?:\/\/[^\s]+/i.test(content)) ||
          (msg.key?.remoteJid?.endsWith("s.whatsapp.net") &&
            bot.WhatsAppSources === WhatsAppSources.Group) ||
          (msg.key?.remoteJid?.endsWith("g.us") &&
            bot.WhatsAppSources === WhatsAppSources.Direct)
        ) {
          continue;
        }

        let imageBufferSet: {
          processedBuffer: Buffer;
          processedBufferBase64: string;
        } | null = null;
        if (bot.SendMethod === SendMethods.Image) {
          try {
            const mediaMessage =
              msg.message?.imageMessage || msg.message?.videoMessage;
            if (mediaMessage) {
              const mediaBuffer = await downloadMediaMessage(msg, "buffer", {});
              if (mediaBuffer) {
                const processedBuffer = await sharp(mediaBuffer)
                  .resize({ width: 600, fit: "inside" })
                  .jpeg({ quality: 50 })
                  .toBuffer();
                const thumbnailBuffer = await sharp(mediaBuffer)
                  .resize({ width: 300, height: 300, fit: "inside" })
                  .jpeg({ quality: 50 })
                  .toBuffer();
                imageBufferSet = {
                  processedBuffer,
                  processedBufferBase64: thumbnailBuffer.toString("base64"),
                };
              } else {
                imageBufferSet =
                  await this.getImageBufferFromMessageContent(content);
              }
            } else {
              imageBufferSet =
                await this.getImageBufferFromMessageContent(content);
            }
          } catch (error) {
            imageBufferSet =
              await this.getImageBufferFromMessageContent(content);
          }
        }

        const messageObj = new Message(
          0,
          content,
          new Date().toISOString(),
          msg.key.remoteJid || null,
          sender,
          imageBufferSet?.processedBuffer || null,
          imageBufferSet?.processedBufferBase64 || null,
          msg
        );

        await createMessage(messageObj, [bot.Id]);

        if (botInstance) {
          this.enqueueMessage(bot.Id, messageObj);
        }

        this.mainWindow.webContents.send("bot:messageQueueUpdate", {
          botId: bot.Id,
          messageQueue: botInstance?.messageQueue || [],
        });
      }
    });

    sock.ev.on("groups.upsert", async (groupsUpsert: GroupMetadata[]) => {
      const instance = this.bots.get(bot.Id);
      if (!instance || !instance.bot.Active || groupsUpsert.length <= 0) return;

      for (const group of groupsUpsert) {
        if (group.id && !instance.groupMetadataCache?.[group.id]) {
          instance.groupMetadataCache = {
            ...instance.groupMetadataCache,
            [group.id]: group,
          };
          await this.handleGroupUpsert(bot.Id, group);
        }
      }
    });

    sock.ev.on(
      "groups.update",
      async (groupsUpdate: Partial<GroupMetadata>[]) => {
        const instance = this.bots.get(bot.Id);
        if (
          !instance ||
          !instance.bot.Active ||
          groupsUpdate?.length <= 0 ||
          instance.isSyncingGroups
        ) {
          return;
        }

        for (const update of groupsUpdate) {
          if (update.id && instance.groupMetadataCache?.[update.id]) {
            const prev = instance.groupMetadataCache[update.id];
            const updatedMeta = { ...prev, ...update };

            if (
              prev.subject !== updatedMeta.subject ||
              prev.size !== updatedMeta.size
            ) {
              instance.groupMetadataCache[update.id] = updatedMeta;
              await this.handleGroupMetadataUpdate(bot.Id, updatedMeta);
            }
          }
        }
      }
    );

    sock.ev.on("group-participants.update", async (groupParticipantsUpdate) => {
      const instance = this.bots.get(bot.Id);
      if (!instance || !instance.bot.Active) return;

      const { id: groupJid, action, participants } = groupParticipantsUpdate;
      const botWaNumber = instance.bot.WaNumber;

      if (
        action === "remove" &&
        botWaNumber &&
        participants.some((p) => p.includes(botWaNumber))
      ) {
        if (instance.groupMetadataCache?.[groupJid]) {
          delete instance.groupMetadataCache[groupJid];
        }
        const groupId = await getGroupIdByJid(groupJid);
        if (groupId) {
          await this.handleBotLeftGroup(bot.Id, groupId);
        }
        return;
      }

      if (!instance.groupMetadataCache?.[groupJid]) return;

      const group = instance.groupMetadataCache[groupJid];
      let cacheUpdated = false;

      if (["add", "remove", "promote", "demote"].includes(action)) {
        if (group.participants && Array.isArray(group.participants)) {
          if (action === "add") {
            for (const jid of participants) {
              if (!group.participants.some((p: any) => p.id === jid)) {
                group.participants.push({ id: jid, admin: null });
                cacheUpdated = true;
              }
            }
          } else if (action === "remove") {
            const before = group.participants.length;
            group.participants = group.participants.filter(
              (p: any) => !participants.includes(p.id)
            );
            if (group.participants.length !== before) cacheUpdated = true;
          } else if (action === "promote") {
            for (const jid of participants) {
              const participant = group.participants.find(
                (p: any) => p.id === jid
              );
              if (participant && participant.admin !== "admin") {
                participant.admin = "admin";
                cacheUpdated = true;
              }
            }
          } else if (action === "demote") {
            for (const jid of participants) {
              const participant = group.participants.find(
                (p: any) => p.id === jid
              );
              if (participant && participant.admin !== null) {
                participant.admin = null;
                cacheUpdated = true;
              }
            }
          }
          instance.groupMetadataCache[groupJid] = group;
        }
      }

      if (cacheUpdated) {
        instance.groupMetadataCache[groupJid] = group;
        await this.handleGroupParticipantsUpdate(
          bot.Id,
          groupParticipantsUpdate
        );
      }
    });

    /* -------------------------- save instance -------------------------- */
    const groups = await getGroupsByBotId(bot.Id);
    const broadcastGroupJids = new Set(
      groups.filter((g) => g.Broadcast).map((g) => g.GroupJid)
    );

    botInstance.broadcastGroupJids = broadcastGroupJids;
    botInstance.bot = bot;
    botInstance.socket = sock;
    botInstance.stop = async () => {
      botInstance.manualDisconnect = true;
      await this.stopBotInstance(bot.Id);
    };

    this.ensureBotQueueState(bot.Id);
    botInstance.isConnecting = false;
  }

  public ensureBotQueueState(botId: number) {
    if (!this.botQueueStates.has(botId)) {
      this.botQueueStates.set(botId, {
        paused: false,
        sending: false,
        currentMessageIndex: 0,
        currentGroupIndex: 0,
      });
    }
  }

  enqueueMessage(botId: number, message: Message) {
    const instance = this.bots.get(botId);
    if (!instance) {
      return;
    }

    instance.messageQueue.push(message);

    if (!instance.bot.sendingMessageInfo) {
      instance.bot.sendingMessageInfo = {
        content: message.Content?.toString() ?? "",
        currentGroup: "",
        currentGroupIndex: 0,
        totalGroups: 0,
        queueLength: instance.messageQueue.length,
      };
    } else {
      instance.bot.sendingMessageInfo.queueLength =
        instance.messageQueue.length;
    }

    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: instance.messageQueue,
    });

    this.processQueue(botId);
  }

  pauseQueue(botId: number) {
    this.ensureBotQueueState(botId);
    const state = this.botQueueStates.get(botId)!;
    state.paused = true;
  }

  resumeQueue(botId: number) {
    this.ensureBotQueueState(botId);
    const state = this.botQueueStates.get(botId)!;
    if (!state.paused) return;
    state.paused = false;
    this.processQueue(botId);
  }

  public async processQueue(botId: number) {
    this.ensureBotQueueState(botId);
    const state = this.botQueueStates.get(botId)!;
    const instance = this.bots.get(botId);

    if (
      !instance ||
      state.sending ||
      state.paused ||
      !instance.socket ||
      !instance.groupMetadataCache ||
      instance.messageQueue.length === 0
    ) {
      return;
    }

    instance.bot.Status = Status.Sending;
    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    state.sending = true;

    while (
      !state.paused &&
      instance.messageQueue.length > 0 &&
      instance.socket?.ws.isOpen
    ) {
      const message = instance.messageQueue[0];
      const broadcastSet = instance.broadcastGroupJids;
      const groupIds = Object.keys(instance.groupMetadataCache);

      const totalGroups = groupIds.filter((groupJid) =>
        broadcastSet?.has(groupJid)
      ).length;

      if (instance.bot.SendingReport) {
        instance.sentCount++;
      } else {
        instance.sentCount = 0;
      }

      while (
        !state.paused &&
        state.currentGroupIndex < groupIds.length &&
        instance.socket?.ws.isOpen
      ) {
        const groupJid = groupIds[state.currentGroupIndex];
        if (!broadcastSet?.has(groupJid)) {
          state.currentGroupIndex++;
          continue;
        }

        const currentGroupIndex =
          groupIds
            .slice(0, state.currentGroupIndex + 1)
            .filter((jid) => broadcastSet?.has(jid)).length - 1;

        instance.bot.sendingMessageInfo = {
          content: message.Content?.toString() ?? "",
          currentGroup:
            instance.groupMetadataCache[groupJid]?.subject || groupJid,
          currentGroupIndex,
          totalGroups,
          queueLength: instance.messageQueue.length,
        };
        this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

        this.mainWindow.webContents.send("bot:messageQueueUpdate", {
          botId,
          messageQueue: instance.messageQueue,
        });

        try {
          await sendMessageToGroupWithTimeout(
            instance,
            message,
            groupJid,
            300000
          );
        } catch (error) {
          console.error(`❌ Error sending message to group ${groupJid}!`);
        }
        state.currentGroupIndex++;

        if (state.currentGroupIndex < groupIds.length && !state.paused) {
          const baseMs = (instance.bot.DelayBetweenGroups ?? 0) * 1000;
          await delay(baseMs, baseMs > 0 ? 1000 : undefined);
        }
        if (state.paused) break;
      }

      if (
        !state.paused &&
        state.currentGroupIndex >= groupIds.length &&
        instance.socket?.ws.isOpen
      ) {
        instance.bot.sendingMessageInfo = {
          content: "",
          currentGroup: "",
          currentGroupIndex: 0,
          totalGroups: 0,
          queueLength: instance.messageQueue.length,
        };
        state.currentGroupIndex = 0;
        if (
          instance.messageQueue.length > 0 &&
          instance.messageQueue[0] === message
        ) {
          instance.messageQueue.splice(0, 1);
          instance.bot.sendingMessageInfo.queueLength--;
        }
        this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
        this.mainWindow.webContents.send("bot:messageQueueUpdate", {
          botId,
          messageQueue: instance.messageQueue,
        });
        if (instance.messageQueue.length > 0) {
          const baseMs = (instance.bot.DelayBetweenMessages ?? 0) * 1000;
          await delay(baseMs, baseMs > 0 ? 1000 : undefined);
        }
      }
    }

    if (
      !state.paused &&
      state.currentMessageIndex >= instance.messageQueue.length
    ) {
      if (
        instance.bot.SendingReport &&
        instance.sentCount > 0 &&
        instance.socket &&
        instance.socket.ws?.isOpen
      ) {
        const totalSent = instance.sentCount;
        instance.sentCount = 0;
        const reportMsg =
          `✅ Lote de envios concluído!` +
          `\n${totalSent} mensagem${totalSent > 1 ? "s" : ""} enviada${totalSent > 1 ? "s" : ""}.`;
        for (const authNumber of instance.authorizedNumbers) {
          const jid = authNumber.WaNumber.endsWith("@s.whatsapp.net")
            ? authNumber.WaNumber
            : `${authNumber.WaNumber}@s.whatsapp.net`;
          try {
            await instance.socket.sendMessage(jid, { text: reportMsg });
          } catch (e) {
            console.error(
              `❌ Error sending report message to ${authNumber.WaNumber}`
            );
          }
        }
      }
      instance.messageQueue = [];
      state.currentMessageIndex = 0;
      state.currentGroupIndex = 0;

      instance.bot.sendingMessageInfo = {
        content: "",
        currentGroup: "",
        currentGroupIndex: 0,
        totalGroups: 0,
        queueLength: 0,
      };

      instance.bot.Status = Status.Online;
      this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
    }

    state.sending = false;
  }

  getBots() {
    return Array.from(this.bots.values()).map((b) => b.bot);
  }

  public async updateBotMemoryState(
    botId: number,
    patch: Partial<Bot>
  ): Promise<Bot | null> {
    const instance = this.bots.get(botId);
    if (!instance) {
      console.error(`❌ Bot instance for ID ${botId} not found.`);
      return null;
    }

    const prevActive = instance.bot.Active;
    const prevPaused = instance.bot.Paused;
    const prevStatus = instance.bot.Status;
    const prevWaNumber = instance.bot.WaNumber;

    Object.assign(instance.bot, patch);

    if (patch.AuthorizedNumbers) {
      instance.authorizedNumbers = patch.AuthorizedNumbers.map(
        (num) => new AuthorizedNumber(botId, num)
      );
    }

    if (patch.WaNumber && patch.WaNumber !== prevWaNumber) {
      const { clearAuthState } = await import("./db-commands");
      await clearAuthState(botId);

      if (instance.socket) {
        await instance.stop?.();
      }
    }

    if (typeof patch.Active === "undefined") instance.bot.Active = prevActive;
    if (typeof patch.Paused === "undefined") instance.bot.Paused = prevPaused;
    if (typeof patch.Status === "undefined") instance.bot.Status = prevStatus;

    if (patch.Active === true && !instance.socket) {
      const state = this.botQueueStates.get(botId);
      if (state) state.paused = false;
      instance.bot.Paused = false;
      await this.startBot(instance.bot);
      this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
    } else if (patch.Active === false) {
      instance.bot.Status = Status.Offline;
      this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

      if (instance.socket) {
        await instance.stop?.();
      }
    }

    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    return instance.bot;
  }

  public getBotInstance(botId: number): BotInstance | undefined {
    return this.bots.get(botId);
  }

  moveMessageUp(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (
      !instance ||
      instance.messageQueue.length < 3 ||
      idx <= 1 ||
      idx >= instance.messageQueue.length
    )
      return;
    const arr = instance.messageQueue;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];

    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: arr,
    });
  }

  moveMessageDown(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (
      !instance ||
      instance.messageQueue.length < 3 ||
      idx <= 0 ||
      idx >= instance.messageQueue.length - 1
    )
      return;
    const arr = instance.messageQueue;
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];

    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: arr,
    });
  }

  deleteMessageFromQueue(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (!instance || idx < 0 || idx >= instance.messageQueue.length) return;
    instance.messageQueue.splice(idx, 1);

    if (idx === 0) {
      const state = this.botQueueStates.get(botId);
      if (state && instance.groupMetadataCache) {
        state.currentGroupIndex = Object.keys(
          instance.groupMetadataCache
        ).length;
      }
    }

    if (instance.messageQueue.length === 0) {
      instance.bot.Status = Status.Online;
    }

    if (instance.bot.sendingMessageInfo) {
      instance.bot.sendingMessageInfo.queueLength =
        instance.messageQueue.length;
      this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
    }

    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: instance.messageQueue,
    });
  }

  moveMessageToTop(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (
      !instance ||
      instance.messageQueue.length < 3 ||
      idx <= 1 ||
      idx >= instance.messageQueue.length
    )
      return;
    const arr = instance.messageQueue;
    const [msg] = arr.splice(idx, 1);
    arr.splice(1, 0, msg);

    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: arr,
    });
  }

  public async getImageBufferFromMessageContent(content: string): Promise<{
    processedBuffer: Buffer;
    processedBufferBase64: string;
  } | null> {
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return null;
    const targetUrl = urlMatch[0];

    try {
      const meta = await metadata(targetUrl);
      const imageUrl = meta.image || meta["og:image"];
      if (!imageUrl) return null;

      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) return null;
      const arrayBuffer = await imageRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const processedBuffer = await sharp(buffer)
        .resize({ width: 600, height: 600, fit: "cover" })
        .jpeg({ quality: 50 })
        .toBuffer();

      const processedThumbnailBuffer = await sharp(buffer)
        .resize({ width: 300, height: 300, fit: "cover" })
        .jpeg({ quality: 50 })
        .toBuffer();

      const processedBufferBase64 = processedThumbnailBuffer.toString("base64");

      return { processedBuffer, processedBufferBase64 };
    } catch (error) {
      console.error("❌ Error fetching or processing image from URL!");
      return null;
    }
  }

  /* --------------------------- stopBotInstance --------------------------- */
  public async stopBotInstance(botId: number) {
    const instance = this.bots.get(botId);
    if (!instance) {
      return;
    }

    this.pauseQueue(botId);

    try {
      if (instance.socket) {
        instance.socket.end(new Error("manual"));
      }
    } catch (error) {
      console.error("❌ Error trying to access socket:", error);
    }

    instance.socket = null;
    instance.isConnecting = false;
    instance.manualDisconnect = false;

    instance.reconnectAttempts = 0;
    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: [],
    });

    instance.bot.Status = Status.Offline;
    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    this.mainWindow.webContents.send("bot:qrCode", {
      botId: instance.bot.Id,
      qr: "",
    });
  }

  private async updateBotGroupsAndMembersStats(botId: number) {
    const stats = await getBotGroupsAndMembers(botId);
    this.mainWindow.webContents.send("bot:groupsAndMembersStatsUpdate", {
      botId,
      stats: {
        broadcastGroups: stats.broadcastGroups,
        broadcastMembers: stats.broadcastMembers,
      },
    });
  }
}

/* -------------------------- singleton export ------------------------- */
let waManager: WaManager | null = null;
export function getWaManager(mainWindow?: Electron.BrowserWindow) {
  if (!waManager && mainWindow) waManager = new WaManager(mainWindow);
  return waManager!;
}

function sanitizeGroupName(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .toLowerCase();
}

function addUtmParamsToLinks(
  content: string,
  params: { source?: string; medium?: string }
): string {
  return content.replace(/https?:\/\/[^\s]+/g, (url) => {
    try {
      const urlObj = new URL(url);
      if (params.source) urlObj.searchParams.set("utm_source", params.source);
      if (params.medium) urlObj.searchParams.set("utm_medium", params.medium);
      return urlObj.toString();
    } catch {
      return url;
    }
  });
}

async function delay(base: number, randomRange?: number): Promise<void> {
  const safeBase = Math.max(100, base);
  let ms = safeBase;
  if (randomRange !== undefined) {
    const safeRange = Math.max(0, randomRange);
    const randomPart = Math.random() * safeRange * 2 - safeRange;
    ms = Math.max(100, safeBase + randomPart);
  }
  await new Promise((res) => setTimeout(res, Math.floor(ms)));
}

async function sendMessageToGroup(
  instance: BotInstance,
  message: Message,
  groupJid: string
) {
  const isMedia =
    message.WaMessage?.message?.imageMessage ||
    message.WaMessage?.message?.videoMessage ||
    message.WaMessage?.message?.ephemeralMessage?.message?.imageMessage ||
    message.WaMessage?.message?.ephemeralMessage?.message?.videoMessage;

  let contentToSend = message.Content ?? "";
  if (instance.bot.SendMethod !== SendMethods.Forward && contentToSend) {
    const linkParam = instance.bot.LinkParameters;
    let params: { source?: string; medium?: string } = {};
    if (
      linkParam === LinkParameters.Source ||
      linkParam === LinkParameters.All
    ) {
      params.source = "whatsapp";
    }
    if (
      linkParam === LinkParameters.Medium ||
      linkParam === LinkParameters.All
    ) {
      const groupMeta =
        instance.groupMetadataCache?.[groupJid]?.subject || groupJid;
      params.medium = sanitizeGroupName(groupMeta);
    }
    if (linkParam !== LinkParameters.None) {
      contentToSend = addUtmParamsToLinks(contentToSend, params);
    }
  }

  const ephemeralDuration =
    instance.groupMetadataCache?.[groupJid]?.ephemeralDuration;

  const sendEphemeral = async (msg: any, opts?: any) => {
    await instance.socket?.sendMessage(groupJid, {
      disappearingMessagesInChat: ephemeralDuration,
    });
    return instance.socket?.sendMessage(groupJid, msg, {
      ...(opts || {}),
      ephemeralExpiration: ephemeralDuration,
    });
  };

  if (ephemeralDuration && ephemeralDuration > 0) {
    if (message.Image) {
      return sendEphemeral({
        image: message.Image,
        caption: contentToSend,
        mimetype: "image/jpeg",
        jpegThumbnail:
          message.ImageThumbnailBase64 || message.Image.toString("base64"),
      });
    } else if (
      message.WaMessage &&
      (instance.bot.SendMethod == SendMethods.Forward || isMedia)
    ) {
      return sendEphemeral({
        forward: message.WaMessage,
      });
    } else {
      return sendEphemeral({
        text: contentToSend,
      });
    }
  } else {
    if (message.Image) {
      return instance.socket?.sendMessage(groupJid, {
        image: message.Image,
        caption: contentToSend,
        mimetype: "image/jpeg",
        jpegThumbnail:
          message.ImageThumbnailBase64 || message.Image.toString("base64"),
      });
    } else if (
      message.WaMessage &&
      (instance.bot.SendMethod == SendMethods.Forward || isMedia)
    ) {
      return instance.socket?.sendMessage(groupJid, {
        forward: message.WaMessage,
      });
    } else {
      return instance.socket?.sendMessage(groupJid, {
        text: contentToSend,
      });
    }
  }
}

async function sendMessageToGroupWithTimeout(
  instance: BotInstance,
  message: Message,
  groupJid: string,
  timeoutMs: number
) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timeout: Message sending took > ${timeoutMs}ms`)),
      timeoutMs
    )
  );

  return Promise.race([
    sendMessageToGroup(instance, message, groupJid),
    timeoutPromise,
  ]);
}

export async function getInviteLinks(
  sock: ReturnType<typeof makeWASocket>,
  waNumber: string | null,
  groups: Group[],
  serverGroups: {
    [_: string]: GroupMetadata;
  }
) {
  const groupsToUpdate = groups.filter(
    (g) => !g.InviteLink || !g.InviteLink.endsWith(":sync")
  );
  if (groupsToUpdate.length <= 0) return;

  for (const group of groupsToUpdate) {
    try {
      const serverGroup = serverGroups[group.GroupJid];
      const isAdmin =
        waNumber &&
        serverGroup?.participants?.some(
          (p) =>
            p.id.includes(waNumber) &&
            (p.admin === "admin" ||
              p.admin === "superadmin" ||
              p.isAdmin ||
              p.isSuperAdmin)
        );
      if (!isAdmin) continue;

      const updatedGroupVersion = await getGroupById(group.Id);
      if (updatedGroupVersion?.InviteLink) continue;

      const inviteCode = isAdmin
        ? await sock.groupInviteCode(group.GroupJid)
        : null;
      if (inviteCode) {
        group.InviteLink = inviteCode;
      } else {
        group.InviteLink = ":sync";
      }
      group.Updated = new Date().toISOString();
      await updateGroup(group);
    } catch (error) {
      console.error(
        `❌ Error fetching invite link for group ${group.GroupJid}:`,
        error
      );
      group.InviteLink = ":sync";
      await updateGroup(group);
    }
    const delayMs = 9000 + Math.random() * 2000;
    await new Promise((res) => setTimeout(res, delayMs));
  }
}
