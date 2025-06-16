import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "baileys";
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
} from "./db-commands";
import { app } from "electron";
import path from "path";
import pino from "pino";
import { Message } from "../models/message-model";
import { AuthorizedNumber } from "../models/authorized-number-model";
import { Group } from "../models/group-model";
import fs from "fs";
import fsp from "fs/promises";
import metadata from "url-metadata";
import sharp from "sharp";

type BotInstance = {
  bot: Bot;
  socket: ReturnType<typeof makeWASocket> | null;
  messageQueue: Message[];
  stop: (() => Promise<void>) | null;
  manualDisconnect?: boolean;
  authorizedNumbers: AuthorizedNumber[];
  groupMetadataCache?: Record<string, any>;
  lastGroupFetch?: number;
  broadcastGroupJids?: Set<string>;
};

type BotQueueState = {
  paused: boolean;
  sending: boolean;
  currentMessageIndex: number;
  currentGroupIndex: number;
};

export class WaManager {
  private mainWindow: Electron.BrowserWindow;
  private bots: Map<number, BotInstance> = new Map();
  private botQueueStates: Map<number, BotQueueState> = new Map();

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async registerBot(bot: Bot) {
    const authorizedNumbers = await getAuthorizedNumbers(bot.Id);

    if (!this.bots.has(bot.Id)) {
      this.bots.set(bot.Id, {
        bot,
        socket: null,
        messageQueue: [],
        stop: null,
        authorizedNumbers,
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
    serverGroupsMetadata: Record<string, any>
  ) {
    const localGroups = await getGroupsByBotId(botId);
    const serverGroupJids = new Set(Object.keys(serverGroupsMetadata));

    for (const groupJid of serverGroupJids) {
      const meta = serverGroupsMetadata[groupJid];
      let groupId: number;
      const localGroup = localGroups.find((g) => g.GroupJid === groupJid);
      if (!localGroup) {
        groupId = await createGroup(
          new Group(0, groupJid, meta.subject, meta.size)
        );
      } else {
        groupId = localGroup.Id;
        await updateGroup(
          new Group(groupId, groupJid, meta.subject, meta.size)
        );
      }
      await createBotGroup(botId, groupId, 0);

      const localMembers = await getMembersByGroupId(groupId);
      const serverMemberJids = new Set(meta.participants.map((p: any) => p.id));

      for (const p of meta.participants) {
        const memberId = await getOrCreateMemberId(p.id);
        await createGroupMember(groupId, memberId, p.admin ? true : false);

        await updateGroupMemberAdmin(groupId, memberId, p.admin ? true : false);
      }

      for (const local of localMembers) {
        if (!serverMemberJids.has(local.MemberJid)) {
          await deleteGroupMember(groupId, local.Id);
        }
      }
    }

    for (const local of localGroups) {
      if (!serverGroupJids.has(local.GroupJid)) {
        await deleteBotGroup(botId, local.Id);
      }
    }
  }

  async startBot(bot: Bot) {
    const authDir = path.join(app.getPath("userData"), "auth", bot.WaNumber);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    let authorizedNumbers = this.bots.get(bot.Id)?.authorizedNumbers;
    if (!authorizedNumbers) {
      authorizedNumbers = await getAuthorizedNumbers(bot.Id);
    }

    const botInstance = this.bots.get(bot.Id);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "error" }),
      cachedGroupMetadata: async (jid) => {
        return botInstance?.groupMetadataCache?.[jid];
      },
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
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

      if (connection === "open") {
        bot.Status = Status.Online;
        await updateBot(bot);
        this.mainWindow.webContents.send("bot:statusUpdate", bot);

        const now = Date.now();
        if (
          !botInstance?.lastGroupFetch ||
          now - botInstance.lastGroupFetch > 60_000
        ) {
          let groupMetadataCache = await sock.groupFetchAllParticipating();
          groupMetadataCache = Object.fromEntries(
            Object.entries(groupMetadataCache).sort(([, a], [, b]) => {
              const subjectA = (a.subject || "").toLowerCase();
              const subjectB = (b.subject || "").toLowerCase();
              return subjectA.localeCompare(subjectB);
            })
          );
          if (botInstance) {
            botInstance.groupMetadataCache = groupMetadataCache;
            botInstance.lastGroupFetch = now;
            await this.syncBotGroupsAndMembers(
              bot.Id,
              botInstance.groupMetadataCache
            );
          }
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const instance = this.bots.get(bot.Id);
        if (statusCode === DisconnectReason.loggedOut) {
          const fs = require("fs");
          const rimraf = require("rimraf");
          try {
            if (fs.existsSync(authDir)) {
              rimraf.sync(authDir);
            }
          } catch (err) {
            console.error("Erro ao remover diretório de autenticação:", err);
          }
          bot.Status = Status.LoggedOut;
          await updateBot(bot);
          this.mainWindow.webContents.send("bot:statusUpdate", bot);
        } else {
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          bot.Status = Status.Disconnected;
          await updateBot(bot);
          this.mainWindow.webContents.send("bot:statusUpdate", bot);
          if (shouldReconnect && !instance?.manualDisconnect) {
            this.startBot(bot);
          }
          if (instance) instance.manualDisconnect = false;
        }
      }
    });

    sock.ev.on("creds.update", async () => {
      const userNumber = sock.user?.id?.match(/^\d+/)?.[0];
      if (userNumber && bot.WaNumber !== userNumber) {
        const oldAuthDir = path.join(
          app.getPath("userData"),
          "auth",
          bot.WaNumber
        );
        const newAuthDir = path.join(
          app.getPath("userData"),
          "auth",
          userNumber
        );

        if (bot.WaNumber !== userNumber) {
          try {
            if (fs.existsSync(oldAuthDir) && !fs.existsSync(newAuthDir)) {
              await fsp.rename(oldAuthDir, newAuthDir);
            }
          } catch (err) {
            console.error("Erro ao renomear pasta de autenticação:", err);
          }
          bot.WaNumber = userNumber;
          await updateBot(bot);
          const instance = this.bots.get(bot.Id);
          if (instance) {
            instance.bot.WaNumber = userNumber;
          }
          this.mainWindow.webContents.send("bot:statusUpdate", bot);
        }
      }
      await saveCreds();
    });

    /** MESSAGES MANAGEMENT **/
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        const sender =
          msg.key?.remoteJid?.endsWith("s.whatsapp.net") &&
          bot.WhatsAppSources !== WhatsAppSources.Group
            ? msg.key.remoteJid
            : msg.key?.remoteJid?.endsWith("g.us") &&
                bot.WhatsAppSources !== WhatsAppSources.Direct &&
                msg.key.participant?.endsWith("s.whatsapp.net")
              ? msg.key.participant
              : "";

        if (
          msg.key.fromMe ||
          !sender ||
          !authorizedNumbers.some((authorizedNumber) =>
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

        if (!content) continue;

        let imageBufferSet: {
          processedBuffer: Buffer;
          processedBufferBase64: string;
        } | null = null;
        if (bot.SendMethod === SendMethods.Image) {
          imageBufferSet = await this.getImageBufferFromMessageContent(content);
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
      }
    });

    if (botInstance) {
      const groups = await getGroupsByBotId(bot.Id);
      const broadcastGroupJids = new Set(
        groups.filter((g) => g.Broadcast).map((g) => g.GroupJid)
      );
      botInstance.broadcastGroupJids = broadcastGroupJids;
    }

    if (botInstance) {
      botInstance.bot = bot;
      botInstance.socket = sock;
      botInstance.stop = async () => {
        sock.end(undefined);
      };
      botInstance.authorizedNumbers = authorizedNumbers;
    } else {
      this.bots.set(bot.Id, {
        bot,
        socket: sock,
        messageQueue: [],
        stop: async () => {
          sock.end(undefined);
        },
        authorizedNumbers,
      });
    }

    this.ensureBotQueueState(bot.Id);
  }

  private ensureBotQueueState(botId: number) {
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

  private async processQueue(botId: number) {
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
    await updateBot(instance.bot);
    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    state.sending = true;

    while (
      !state.paused &&
      state.currentMessageIndex < instance.messageQueue.length
    ) {
      const message = instance.messageQueue[state.currentMessageIndex];
      const broadcastSet = instance.broadcastGroupJids;
      const groupIds = Object.keys(instance.groupMetadataCache);

      const totalGroups = groupIds.filter((groupJid) =>
        broadcastSet?.has(groupJid)
      ).length;

      while (!state.paused && state.currentGroupIndex < groupIds.length) {
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
        };
        this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

        try {
          if (
            instance.bot.SendMethod !== SendMethods.Forward &&
            Math.random() < 0.5
          ) {
            await instance.socket.sendPresenceUpdate("composing", groupJid);
            await delay(100 + Math.floor(Math.random() * 900));
            await instance.socket.sendPresenceUpdate("paused", groupJid);
          }
          await sendMessageToGroup(instance, message, groupJid);
        } catch (err) {
          console.error(`Erro ao enviar mensagem para grupo ${groupJid}:`, err);
        }
        state.currentGroupIndex++;

        if (state.currentGroupIndex < groupIds.length && !state.paused) {
          await delay((instance.bot.DelayBetweenGroups || 1) * 1000, 1000);
        }
        if (state.paused) break;
      }
      if (!state.paused) {
        instance.bot.sendingMessageInfo = undefined;
        this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
      }

      if (!state.paused) {
        state.currentGroupIndex = 0;
        state.currentMessageIndex++;
        this.mainWindow.webContents.send("bot:messageQueueUpdate", {
          botId,
          messageQueue: instance.messageQueue.slice(state.currentMessageIndex),
        });
        if (state.currentMessageIndex < instance.messageQueue.length) {
          await delay((instance.bot.DelayBetweenMessages || 1) * 1000, 1000);
        }
      }
    }

    if (
      !state.paused &&
      state.currentMessageIndex >= instance.messageQueue.length
    ) {
      instance.messageQueue = [];
      state.currentMessageIndex = 0;
      state.currentGroupIndex = 0;
      this.mainWindow.webContents.send("bot:messageQueueUpdate", {
        botId,
        messageQueue: [],
      });

      instance.bot.Status = Status.Online;
      await updateBot(instance.bot);
      this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);
    }

    state.sending = false;
  }

  getBots() {
    return Array.from(this.bots.values()).map((b) => b.bot);
  }

  async updateBotMemoryState(
    botId: number,
    patch: Partial<Bot>
  ): Promise<Bot | null> {
    const instance = this.bots.get(botId);
    if (!instance) return null;

    const prevActive = instance.bot.Active;
    const prevPaused = instance.bot.Paused;
    const prevStatus = instance.bot.Status;

    Object.assign(instance.bot, patch);

    if (typeof patch.Active === "undefined") instance.bot.Active = prevActive;
    if (typeof patch.Paused === "undefined") instance.bot.Paused = prevPaused;
    if (typeof patch.Status === "undefined") instance.bot.Status = prevStatus;

    if (patch.Active === true && !instance.socket) {
      this.startBot(instance.bot);
    }
    if (patch.Active === false && instance.socket) {
      instance.manualDisconnect = true;
      await instance.stop?.();
      instance.socket = null;
      instance.messageQueue = [];
      instance.stop = null;
      instance.bot.Status = Status.Offline;
      this.mainWindow.webContents.send("bot:qrCode", {
        botId: instance.bot.Id,
        qr: "",
      });
    }

    this.mainWindow.webContents.send("bot:statusUpdate", instance.bot);

    return instance.bot;
  }

  public getBotInstance(botId: number): BotInstance | undefined {
    return this.bots.get(botId);
  }

  moveMessageUp(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (!instance || idx <= 0 || idx >= instance.messageQueue.length) return;
    const arr = instance.messageQueue;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: arr,
    });
  }

  moveMessageDown(botId: number, idx: number) {
    const instance = this.bots.get(botId);
    if (!instance || idx < 0 || idx >= instance.messageQueue.length - 1) return;
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
    this.mainWindow.webContents.send("bot:messageQueueUpdate", {
      botId,
      messageQueue: instance.messageQueue,
    });
  }

  async getImageBufferFromMessageContent(content: string): Promise<{
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
        .resize({ width: 600 })
        .jpeg({ quality: 50 })
        .toBuffer();

      const processedBufferBase64 = await sharp(buffer)
        .resize({ width: 300 })
        .jpeg({ quality: 50 })
        .toBuffer()
        .then((buf) => buf.toString("base64"));

      return { processedBuffer, processedBufferBase64 };
    } catch (err) {
      console.error("Erro ao obter ou processar imagem da URL:", err);
      return null;
    }
  }
}

let waManager: WaManager | null = null;

export function getWaManager(mainWindow?: Electron.BrowserWindow) {
  if (!waManager && mainWindow) {
    waManager = new WaManager(mainWindow);
  }
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
  const minBase = Math.max(1000, base);
  let ms = minBase;
  if (randomRange !== undefined) {
    const safeRange = Math.max(0, randomRange);
    ms = minBase + Math.floor(Math.random() * (safeRange * 2 + 1));
  }
  await new Promise((res) => setTimeout(res, ms));
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

  if (message.Image) {
    await instance.socket?.sendMessage(groupJid, {
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
    await instance.socket?.sendMessage(groupJid, {
      forward: message.WaMessage,
    });
  } else {
    await instance.socket?.sendMessage(groupJid, {
      text: contentToSend,
    });
  }
}
