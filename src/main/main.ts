import "./logging-setup";
import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";

import cron from "node-cron";
import { autoUpdater } from "electron-updater";

import { setupIpcHandlers } from "./ipc-handlers";
import { getWaManager } from "./wa-manager";
import { purgeOldMessages, getAppSettings } from "./db-commands";
import { dbReady } from "./db-connection";
import { checkLicense, sendSyncData } from "./server-manager";
import { loadSchedulesForToday, tickSchedules } from "./schedule-manager";

import { PlanTier } from "../models/app-settings-options-model";
import { Status } from "../models/bot-options-model";

import { logger } from "./logger";

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      sandbox: false,
    },
  });

  // mainWindow.webContents.on("before-input-event", (_event, input) => {
  //   if (input.key === "F12" && input.type === "keyDown") {
  //     mainWindow.webContents.openDevTools({ mode: "detach" });
  //   }
  // });

  mainWindow.maximize();

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", async (event) => {
    const waManager = getWaManager();
    const bots = waManager.getBots();
    const hasActiveBot = bots.some((bot) => bot.Active);

    if (!hasActiveBot) {
      return;
    }

    event.preventDefault();

    if (mainWindow?.webContents?.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send("app:confirm-exit");

    const shouldClose = await new Promise<boolean>((resolve) => {
      ipcMain.once("app:confirm-exit-response", (_evt, result) => {
        resolve(result);
      });
    });

    if (shouldClose) {
      mainWindow.destroy();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

function setupAutoUpdater(win: BrowserWindow) {
  autoUpdater.autoDownload = true;

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-downloaded");
  });

  autoUpdater.checkForUpdates();

  ipcMain.on("confirm-update-install", () => {
    setImmediate(() => {
      autoUpdater.quitAndInstall();
    });
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId("com.electron");

    setupIpcHandlers();

    mainWindow = createWindow();

    const waManager = getWaManager(mainWindow);

    const triggerInit = async () => {
      try {
        await dbReady;
        waManager.init();
      } catch (e) {
        console.error("❌ Error during WaManager.init() after load:", e);
        logger.error("❌ Error during WaManager.init() after load:", e);
      }
    };
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once("did-finish-load", () => {
        triggerInit();
      });
    } else {
      triggerInit();
    }

    await dbReady;

    try {
      await purgeOldMessages();
    } catch (error) {
      console.error("❌ Error purging old messages!", error);
      logger.error("❌ Error purging old messages!", error);
    }

    // Preload today's schedules once at startup
    try {
      await loadSchedulesForToday();
    } catch (error) {
      console.error("❌ Error loading today's schedules on startup!", error);
      logger.error("❌ Error loading today's schedules on startup!", error);
    }

    checkLicense(import.meta.env.MAIN_VITE_API_URL || "", mainWindow!);

    setupAutoUpdater(mainWindow);

    const settings = await getAppSettings();
    waManager.appSettings = settings;
    if (
      settings?.PlanTier === PlanTier.Enterprise &&
      settings?.SyncInterval > 0
    ) {
      cron.schedule("* * * * *", async () => {
        const now = new Date();
        const minute = now.getMinutes();
        const hour = now.getHours();

        // schedules: refresh at midnight and check current minute
        try {
          if (hour === 0 && minute === 0) {
            await loadSchedulesForToday(now);
          }
          await tickSchedules(now, waManager);
        } catch (error) {
          console.error(
            "❌ Error running schedule tick (enterprise cron)!",
            error
          );
          logger.error(
            "❌ Error running schedule tick (enterprise cron)!",
            error
          );
        }

        if (hour === 0 && minute === 15) {
          try {
            await checkLicense(
              import.meta.env.MAIN_VITE_API_URL || "",
              mainWindow!
            );
            try {
              await purgeOldMessages();
            } catch (error) {
              console.error("❌ Error purging old messages (cron)!", error);
              logger.error("❌ Error purging old messages (cron)!", error);
            }
          } catch (error) {
            console.error("❌ Error checking license!", error);
            logger.error("❌ Error checking license!", error);
          }
        }

        const currentSettings = await getAppSettings();
        waManager.appSettings = currentSettings;
        if (
          currentSettings?.PlanTier === PlanTier.Enterprise &&
          currentSettings?.SyncInterval > 0
        ) {
          const bots = waManager.getBots();
          const botsWithBroadcastGroups = bots.map((bot) => {
            const instance = waManager.bots.get(bot.Id);
            if (
              waManager.appSettings?.LastSync &&
              bot.Updated > waManager.appSettings.LastSync
            ) {
              const broadcastGroups = instance?.broadcastGroupJids?.size ?? 0;
              return bot.Status === Status.Offline
                ? bot
                : bot.Status === Status.Sending
                  ? {
                      ...bot,
                      BroadcastGroups: broadcastGroups,
                      QueueSize: instance?.messageQueue?.length ?? 0,
                    }
                  : {
                      ...bot,
                      BroadcastGroups: broadcastGroups,
                    };
            } else {
              return {
                WaNumber: bot.WaNumber,
                Status: bot.Status,
              };
            }
          });

          const interval = Math.min(currentSettings.SyncInterval, 60);
          const syncGroups = minute % interval === 0;
          try {
            await sendSyncData(
              import.meta.env.MAIN_VITE_API_URL || "",
              botsWithBroadcastGroups,
              syncGroups
            );
          } catch (error) {
            console.error("❌ Error sending sync data (cron)!", error);
            logger.error("❌ Error sending sync data (cron)!", error);
          }
        }
      });
    } else {
      // Always run scheduler every minute (non-enterprise too)
      cron.schedule("* * * * *", async () => {
        const now = new Date();
        try {
          if (now.getHours() === 0 && now.getMinutes() === 0) {
            await loadSchedulesForToday(now);
          }
          await tickSchedules(now, waManager);
        } catch (error) {
          console.error("❌ Error running schedule tick!", error);
          logger.error("❌ Error running schedule tick!", error);
        }
      });

      cron.schedule("15 0 * * *", async () => {
        try {
          await checkLicense(
            import.meta.env.MAIN_VITE_API_URL || "",
            mainWindow!
          );
          try {
            await purgeOldMessages();
          } catch (error) {
            console.error("❌ Error purging old messages (cron)!", error);
            logger.error("❌ Error purging old messages (cron)!", error);
          }
        } catch (error) {
          console.error("❌ Error checking license!", error);
          logger.error("❌ Error checking license!", error);
        }
      });
    }

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        const waManager = getWaManager(mainWindow);
        const triggerInit = async () => {
          try {
            await dbReady;
            waManager.init();
          } catch (e) {
            console.error(
              "❌ Error during WaManager.init() after activate:",
              e
            );
            logger.error("❌ Error during WaManager.init() after activate:", e);
          }
        };
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once("did-finish-load", () => {
            triggerInit();
          });
        } else {
          triggerInit();
        }
      } else if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
