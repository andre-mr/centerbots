import { ipcMain } from "electron";
import {
  getAllBots,
  getGroupsByBotId,
  updateBot,
  deleteBot,
  createBot,
  getAppSettings,
  updateAppSettings,
  getBotGroupsAndMembers,
  getBotGroupsByBotId,
  updateBotGroupsBroadcast,
  getBotById,
  getGlobalStats,
  getMessagesByPeriod,
} from "./db-commands";
import { Bot } from "../models/bot-model";
import { getWaManager } from "./wa-manager";
import fs from "fs";
import path from "path";
import { app } from "electron";

export function setupIpcHandlers() {
  ipcMain.handle("settings:get", async () => {
    return getAppSettings();
  });

  ipcMain.handle("settings:update", async (_event, settings) => {
    const appSettings = await getAppSettings();
    if (
      appSettings &&
      (appSettings.UserId !== settings.UserId ||
        appSettings.LicenseKey !== settings.LicenseKey ||
        appSettings.SyncInterval != settings.SyncInterval)
    ) {
      await updateAppSettings(settings);
      app.relaunch();
      app.exit(0);
    } else {
      await updateAppSettings(settings);
    }
    return getAppSettings();
  });

  ipcMain.handle("bots:create", async (_event, bot: Bot) => {
    const currentBots = await getAllBots();
    if (currentBots.length >= 6) {
      throw new Error(
        "Não é possível adicionar mais bots. O limite de 6 bots foi atingido."
      );
    }

    const lastInsertedId = await createBot(bot);
    const waManager = getWaManager();
    const createdBot = await getBotById(lastInsertedId);
    if (createdBot) {
      await waManager.registerBot(createdBot);
    }
    return getAllBots();
  });

  ipcMain.handle("bots:update", async (_event, bot: Bot) => {
    if (!bot || !bot.Id)
      throw new Error("Bot data with ID is required for update.");

    await updateBot(bot);

    const waManager = getWaManager();
    const currentBot = await getBotById(bot.Id);
    if (currentBot) {
      const { Active, Paused, Status, ...dbPatch } = currentBot as any;
      waManager.updateBotMemoryState(bot.Id, dbPatch);
    }

    return getAllBots();
  });

  ipcMain.handle("bots:delete", async (_event, botId: number) => {
    const bot = await getBotById(botId);
    if (bot && bot.WaNumber) {
      const authDir = path.join(app.getPath("userData"), "auth", bot.WaNumber);
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }
    }
    await deleteBot(botId);
    return getAllBots();
  });

  ipcMain.handle("bots:getAll", async () => {
    return getAllBots();
  });

  ipcMain.handle("bots:getGroupsByBot", async (_event, botId) => {
    if (!botId) throw new Error("Bot ID is required");
    return getGroupsByBotId(botId);
  });

  ipcMain.handle("bots:getBotGroupsByBot", async (_event, botId) => {
    if (!botId) throw new Error("Bot ID is required");
    return getBotGroupsByBotId(botId);
  });

  ipcMain.handle("bots:getGroupsAndMembersStats", async (_event, botId) => {
    if (!botId) throw new Error("Bot ID is required");
    return getBotGroupsAndMembers(botId);
  });

  ipcMain.handle("stats:getGlobal", async () => {
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekDate = new Date(now);
    const day = weekDate.getDay();
    const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(weekDate.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    return getGlobalStats(
      startOfMonth.toISOString(),
      startOfWeek.toISOString(),
      startOfToday.toISOString()
    );
  });

  ipcMain.handle(
    "bots:updateBotState",
    async (_event, botId: number, patch: Partial<Bot>) => {
      const waManager = getWaManager();
      const updatedBot = waManager.updateBotMemoryState(botId, patch);

      if (typeof patch.Paused === "boolean") {
        if (patch.Paused) {
          waManager.pauseQueue(botId);
        } else {
          waManager.resumeQueue(botId);
        }
      }

      if (updatedBot) {
        return updatedBot;
      }
      throw new Error("Bot não encontrado em memória");
    }
  );

  ipcMain.handle(
    "bots:updateBotGroupsBroadcast",
    async (_event, botId, groups) => {
      if (!botId || !Array.isArray(groups)) throw new Error("Dados inválidos");
      await updateBotGroupsBroadcast(botId, groups);

      const waManager = getWaManager();
      const botInstance = (waManager as any).bots?.get(botId);
      if (botInstance) {
        const allGroups = await getGroupsByBotId(botId);
        const broadcastGroupJids = new Set(
          groups
            .filter((g: any) => g.Broadcast)
            .map((g: any) => {
              const found = allGroups.find((ag) => ag.Id === g.GroupId);
              return found?.GroupJid;
            })
            .filter(Boolean)
        );
        botInstance.broadcastGroupJids = broadcastGroupJids;
      }
      return;
    }
  );

  ipcMain.handle("bots:getMemoryState", async () => {
    const waManager = getWaManager();
    return waManager.getBots();
  });

  ipcMain.handle("bots:pauseQueue", async (_event, botId: number) => {
    const waManager = getWaManager();
    waManager.pauseQueue(botId);
  });

  ipcMain.handle("bots:resumeQueue", async (_event, botId: number) => {
    const waManager = getWaManager();
    waManager.resumeQueue(botId);
  });

  ipcMain.handle("bots:getMessageQueue", async (_event, botId: number) => {
    if (!botId) throw new Error("Bot ID is required");
    const waManager = getWaManager();
    const botInstance = waManager.getBotInstance(botId);
    return botInstance?.messageQueue || [];
  });

  ipcMain.handle(
    "messages:getByPeriod",
    async (_event, from: string, to: string, botId?: number) => {
      return getMessagesByPeriod(from, to, botId);
    }
  );

  ipcMain.handle(
    "bots:moveMessageUp",
    async (_event, botId: number, idx: number) => {
      const waManager = getWaManager();
      waManager.moveMessageUp(botId, idx);
    }
  );

  ipcMain.handle(
    "bots:moveMessageDown",
    async (_event, botId: number, idx: number) => {
      const waManager = getWaManager();
      waManager.moveMessageDown(botId, idx);
    }
  );

  ipcMain.handle(
    "bots:moveMessageToTop",
    async (_event, botId: number, idx: number) => {
      const waManager = getWaManager();
      waManager.moveMessageToTop(botId, idx);
    }
  );

  ipcMain.handle(
    "bots:deleteMessageFromQueue",
    async (_event, botId: number, idx: number) => {
      const waManager = getWaManager();
      waManager.deleteMessageFromQueue(botId, idx);
    }
  );
}
