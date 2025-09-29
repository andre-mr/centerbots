import { ipcMain } from "electron";
import {
  getAllBots,
  getGroupsByBotId,
  updateBot,
  deleteBot,
  clearAuthState,
  createBot,
  getAppSettings,
  updateAppSettings,
  getBotGroupsAndMembers,
  getBotGroupsByBotId,
  updateBotGroupsBroadcast,
  getBotById,
  getGlobalStats,
  getMessagesByPeriod,
  getAllSchedulesLite,
  getScheduleById,
  createSchedule as dbCreateSchedule,
  updateSchedule as dbUpdateSchedule,
  deleteSchedule as dbDeleteSchedule,
} from "./db-commands";
import { Schedule } from "../models/schedule-model";
import { loadSchedulesForToday } from "./schedule-manager";
import {
  saveImageFromBase64,
  saveVideoFromBase64,
  deleteMedia,
  resolveAbsolutePath,
} from "./media-storage";
import fs from "fs";
import { Bot } from "../models/bot-model";
import { getWaManager } from "./wa-manager";
import path from "path";
import { app, dialog } from "electron";
import AdmZip from "adm-zip";
import { closeDatabase } from "./db-connection";

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

  ipcMain.handle("bots:unlink", async (_event, botId: number) => {
    if (!botId) throw new Error("Bot ID e obrigatorio");

    const waManager = getWaManager();
    await waManager.updateBotMemoryState(botId, {
      Active: false,
    });

    await clearAuthState(botId);

    return true;
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

  /* ----------------------------- Schedules IPC ---------------------------- */
  ipcMain.handle("schedules:getAllLite", async () => {
    return getAllSchedulesLite();
  });

  ipcMain.handle("schedules:getById", async (_event, id: number) => {
    // Return schedule as-is; UI relies on Medias
    return getScheduleById(id);
  });

  // Provide a simple data URL for previewing stored medias (image/video)
  ipcMain.handle("media:getDataUrl", async (_event, relPath: string) => {
    try {
      const abs = resolveAbsolutePath(relPath);
      if (!fs.existsSync(abs)) return null;
      const buf = fs.readFileSync(abs);
      const ext = (relPath.split(".").pop() || "").toLowerCase();
      const mime =
        ext === "mp4"
          ? "video/mp4"
          : ext === "webm"
            ? "video/webm"
            : ext === "png"
              ? "image/png"
              : ext === "gif"
                ? "image/gif"
                : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "schedules:create",
    async (
      _event,
      data: Omit<Schedule, "Images"> & {
        ImagesBase64?: Array<string | { Base64: string; Ext?: string }>;
        VideosBase64?: Array<string | { Base64: string; Ext?: string }>;
      }
    ) => {
      // Normalize inputs
      const contents: string[] = Array.isArray((data as any).Contents)
        ? ((data as any).Contents as string[])
        : [];
      const imagesAny = Array.isArray(data.ImagesBase64)
        ? (data.ImagesBase64 as any[])
        : [];

      // First create schedule with empty medias
      const toSave = new Schedule(
        0,
        data.Description ?? "",
        contents,
        [],
        [],
        data.Created || new Date().toISOString(),
        data.LastRun || "",
        data.BotIds || [],
        data.Once || null,
        data.Daily || null,
        data.Weekly || null,
        data.Monthly || null
      );
      const id = await dbCreateSchedule(toSave);

      // Persist images to disk and update medias
      const desc = (data.Description || String(id)).toString();
      const mediaPaths: string[] = [];
      const detectFromBase64 = (
        input: string
      ): { base64: string; ext: string } => {
        let payload = input;
        let ext = "jpg";
        if (payload.startsWith("data:")) {
          const m = payload.match(/^data:([^;]+);base64,(.*)$/i);
          if (m) {
            const mime = m[1].toLowerCase();
            payload = m[2];
            if (mime.includes("png")) ext = "png";
            else if (mime.includes("webp")) ext = "webp";
            else if (mime.includes("gif")) ext = "gif";
            else ext = "jpg";
            return { base64: payload, ext };
          }
        }
        try {
          const buf = Buffer.from(payload, "base64");
          if (buf.length >= 12) {
            if (
              buf[0] === 0x89 &&
              buf[1] === 0x50 &&
              buf[2] === 0x4e &&
              buf[3] === 0x47
            )
              ext = "png";
            else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
              ext = "jpg";
            else if (
              buf[0] === 0x47 &&
              buf[1] === 0x49 &&
              buf[2] === 0x46 &&
              buf[3] === 0x38
            )
              ext = "gif";
            else if (
              buf[0] === 0x52 &&
              buf[1] === 0x49 &&
              buf[2] === 0x46 &&
              buf[3] === 0x46 &&
              buf[8] === 0x57 &&
              buf[9] === 0x45 &&
              buf[10] === 0x42 &&
              buf[11] === 0x50
            )
              ext = "webp";
          }
        } catch {}
        return { base64: payload, ext };
      };
      for (const it of imagesAny) {
        try {
          if (typeof it === "string") {
            const { base64, ext } = detectFromBase64(it);
            const rel = saveImageFromBase64(id, desc, ext, base64);
            mediaPaths.push(rel);
          } else if (it && typeof it === "object") {
            const base64 = (it.Base64 || it.base64 || "").toString();
            if (!base64) continue;
            let ext = (it.Ext || it.ext || "").toString().toLowerCase();
            if (!ext) ext = detectFromBase64(base64).ext;
            const rel = saveImageFromBase64(id, desc, ext, base64);
            mediaPaths.push(rel);
          }
        } catch {}
      }

      // Persist videos
      const videos = Array.isArray((data as any).VideosBase64)
        ? ((data as any).VideosBase64 as Array<
            string | { Base64: string; Ext?: string }
          >)
        : [];
      for (const v of videos) {
        try {
          const base64 = typeof v === "string" ? v : v?.Base64;
          if (!base64 || base64.length === 0) continue;
          const ext = typeof v === "object" && v?.Ext ? v.Ext! : "mp4";
          const rel = saveVideoFromBase64(id, desc, ext, base64);
          mediaPaths.push(rel);
        } catch {}
      }

      const finalSchedule = new Schedule(
        id,
        data.Description ?? String(id),
        contents,
        [],
        mediaPaths,
        data.Created || new Date().toISOString(),
        data.LastRun || "",
        data.BotIds || [],
        data.Once || null,
        data.Daily || null,
        data.Weekly || null,
        data.Monthly || null
      );
      await dbUpdateSchedule(finalSchedule);

      try {
        await loadSchedulesForToday();
      } catch {}
      return id;
    }
  );

  ipcMain.handle(
    "schedules:update",
    async (
      _event,
      data: Omit<Schedule, "Images"> & {
        ImagesBase64?: Array<string | { Base64: string; Ext?: string }>; // new images to add
        VideosBase64?: Array<string | { Base64: string; Ext?: string }>; // new videos to add
        RemovedMediaRelPaths?: string[]; // list of relative media paths to remove from schedule
      }
    ) => {
      if (!data.Id) throw new Error("Schedule ID is required");
      const existing = await getScheduleById(data.Id);
      const imagesAny = Array.isArray(data.ImagesBase64)
        ? (data.ImagesBase64 as any[])
        : [];

      const prevMedias = Array.isArray(existing?.Medias)
        ? (existing!.Medias as string[])
        : [];
      // Apply removals upfront (works for images and videos)
      const removedSet = new Set((data as any).RemovedMediaRelPaths || []);
      const filteredPrevMedias = prevMedias.filter((m) => !removedSet.has(m));
      for (const rel of removedSet) {
        try {
          deleteMedia(String(rel));
        } catch {}
      }

      const desc = (data.Description || String(data.Id)).toString();
      const newImagePaths: string[] = [];
      const detectFromBase64 = (
        input: string
      ): { base64: string; ext: string } => {
        let payload = input;
        let ext = "jpg";
        if (payload.startsWith("data:")) {
          const m = payload.match(/^data:([^;]+);base64,(.*)$/i);
          if (m) {
            const mime = m[1].toLowerCase();
            payload = m[2];
            if (mime.includes("png")) ext = "png";
            else if (mime.includes("webp")) ext = "webp";
            else if (mime.includes("gif")) ext = "gif";
            else ext = "jpg";
            return { base64: payload, ext };
          }
        }
        try {
          const buf = Buffer.from(payload, "base64");
          if (buf.length >= 12) {
            if (
              buf[0] === 0x89 &&
              buf[1] === 0x50 &&
              buf[2] === 0x4e &&
              buf[3] === 0x47
            )
              ext = "png";
            else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
              ext = "jpg";
            else if (
              buf[0] === 0x47 &&
              buf[1] === 0x49 &&
              buf[2] === 0x46 &&
              buf[3] === 0x38
            )
              ext = "gif";
            else if (
              buf[0] === 0x52 &&
              buf[1] === 0x49 &&
              buf[2] === 0x46 &&
              buf[3] === 0x46 &&
              buf[8] === 0x57 &&
              buf[9] === 0x45 &&
              buf[10] === 0x42 &&
              buf[11] === 0x50
            )
              ext = "webp";
          }
        } catch {}
        return { base64: payload, ext };
      };
      for (const it of imagesAny) {
        try {
          if (typeof it === "string") {
            const { base64, ext } = detectFromBase64(it);
            const rel = saveImageFromBase64(data.Id, desc, ext, base64);
            newImagePaths.push(rel);
          } else if (it && typeof it === "object") {
            const base64 = (it.Base64 || it.base64 || "").toString();
            if (!base64) continue;
            let ext = (it.Ext || it.ext || "").toString().toLowerCase();
            if (!ext) ext = detectFromBase64(base64).ext;
            const rel = saveImageFromBase64(data.Id, desc, ext, base64);
            newImagePaths.push(rel);
          }
        } catch {
          // ignore failures and continue with remaining media
        }
      }

      const contents: string[] = Array.isArray((data as any).Contents)
        ? ((data as any).Contents as string[])
        : [];

      // Append new videos
      const newVideoPaths: string[] = [];
      const videos = Array.isArray((data as any).VideosBase64)
        ? ((data as any).VideosBase64 as Array<
            string | { Base64: string; Ext?: string }
          >)
        : [];
      for (const v of videos) {
        try {
          const base64 = typeof v === "string" ? v : v?.Base64;
          if (!base64 || base64.length === 0) continue;
          const vext = typeof v === "object" && v?.Ext ? v.Ext! : "mp4";
          const rel = saveVideoFromBase64(data.Id, desc, vext, base64);
          newVideoPaths.push(rel);
        } catch {}
      }

      const finalMedias = [
        ...filteredPrevMedias,
        ...newImagePaths,
        ...newVideoPaths,
      ];

      const finalSchedule = new Schedule(
        data.Id,
        data.Description ?? String(data.Id),
        contents,
        [],
        finalMedias,
        data.Created || new Date().toISOString(),
        data.LastRun || "",
        data.BotIds || [],
        data.Once || null,
        data.Daily || null,
        data.Weekly || null,
        data.Monthly || null
      );
      await dbUpdateSchedule(finalSchedule);
      try {
        await loadSchedulesForToday();
      } catch {}
      return true;
    }
  );

  ipcMain.handle("schedules:delete", async (_event, id: number) => {
    await dbDeleteSchedule(id);
    try {
      await loadSchedulesForToday();
    } catch {}
    return true;
  });

  /* ------------------------------- Backup IPC ------------------------------- */
  ipcMain.handle("backup:create", async () => {
    // Ask user to choose a destination folder
    const selection = await dialog.showOpenDialog({
      title: "Selecionar pasta para salvar backup",
      properties: ["openDirectory", "createDirectory"],
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    try {
      const targetDir = selection.filePaths[0];

      const userData = app.getPath("userData");
      const dbFile = path.join(userData, "centerbots.db");
      const mediaDir = path.join(userData, "media");

      // Build backup file name: centerbots_backup_yyyy-mm-dd-hh-mm-ss.zip
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const name = `centerbots_backup_${now.getFullYear()}${pad(
        now.getMonth() + 1
      )}${pad(now.getDate())}-${pad(now.getHours())}${pad(
        now.getMinutes()
      )}${pad(now.getSeconds())}.zip`;
      const outZip = path.join(targetDir, name);

      const zip = new AdmZip();

      // Add DB if exists
      if (fs.existsSync(dbFile)) {
        zip.addLocalFile(dbFile);
      }

      // Add media folder if exists (as 'media' root in archive)
      if (fs.existsSync(mediaDir)) {
        zip.addLocalFolder(mediaDir, "media");
      }

      zip.writeZip(outZip);

      return { ok: true, path: outZip };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("backup:restoreHot", async () => {
    const selection = await dialog.showOpenDialog({
      title: "Selecionar arquivo de backup (.zip)",
      properties: ["openFile"],
      filters: [{ name: "Backup Zip", extensions: ["zip"] }],
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    try {
      const zipPath = selection.filePaths[0];
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const norm = (s: string) => s.replace(/\\/g, "/");
      const hasDb = entries.some((e) => norm(e.entryName) === "centerbots.db");
      if (!hasDb) {
        return {
          ok: false,
          error: "Arquivo de backup inválido: centerbots.db ausente",
        };
      }

      const userData = app.getPath("userData");
      const tmpDir = path.join(userData, `restore-tmp-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      // Extract DB
      zip.extractEntryTo("centerbots.db", tmpDir, false, true);

      // Extract media if present
      const hasMedia = entries.some((e) =>
        norm(e.entryName).startsWith("media/")
      );
      if (hasMedia) {
        try {
          zip.extractEntryTo("media/", tmpDir, true, true);
        } catch {}
      }

      // Stop bots and close DB
      try {
        const waManager = getWaManager();
        await (waManager as any).stopAllBots?.();
      } catch {}

      try {
        await closeDatabase();
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || "Falha ao fechar banco de dados",
        };
      }

      // Replace files
      const dbFile = path.join(userData, "centerbots.db");
      const mediaDir = path.join(userData, "media");
      const tmpDb = path.join(tmpDir, "centerbots.db");
      const tmpMedia = path.join(tmpDir, "media");

      // Optional: backup current DB
      if (fs.existsSync(dbFile)) {
        try {
          const bak = path.join(userData, `centerbots.db.bak-${Date.now()}`);
          fs.copyFileSync(dbFile, bak);
        } catch {}
      }

      if (fs.existsSync(tmpDb)) {
        try {
          if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
        } catch {}
        fs.renameSync(tmpDb, dbFile);
      }

      if (fs.existsSync(tmpMedia)) {
        try {
          if (fs.existsSync(mediaDir))
            fs.rmSync(mediaDir, { recursive: true, force: true });
        } catch {}
        try {
          // Try fast move; fallback to copy
          try {
            fs.renameSync(tmpMedia, mediaDir);
          } catch {
            if ((fs as any).cpSync) {
              (fs as any).cpSync(tmpMedia, mediaDir, { recursive: true });
            } else {
              copyDir(tmpMedia, mediaDir);
            }
          }
        } catch {}
      }

      // Cleanup temp
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}

      // Relaunch shortly to allow renderer to handle response
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 200);

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }

    function copyDir(src: string, dest: string) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if ((entry as any).isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
      }
    }
  });
}
