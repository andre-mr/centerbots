import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import { setupIpcHandlers } from "./ipc-handlers";
import { getWaManager } from "./wa-manager";
import { autoUpdater } from "electron-updater";
import { ipcMain } from "electron";
import cron from "node-cron";
import { purgeOldMessages, getAppSettings } from "./db-commands";
import { checkLicense, sendSyncData } from "./server-manager";
import { dbReady } from "./db-connection";
import { PlanTier } from "../models/app-settings-options-model";
import { Status } from "../models/bot-options-model";

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

  // setupIpcHandlers();

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

    await dbReady;

    try {
      await purgeOldMessages();
    } catch (error) {
      console.error("❌ Error purging old messages!");
    }

    checkLicense(import.meta.env.MAIN_VITE_API_URL || "", mainWindow!);

    const waManager = getWaManager(mainWindow);

    mainWindow.webContents.once("did-finish-load", () => {
      waManager.init();
    });

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

        if (hour === 0 && minute === 15) {
          try {
            await checkLicense(
              import.meta.env.MAIN_VITE_API_URL || "",
              mainWindow!
            );
            try {
              await purgeOldMessages();
            } catch (error) {
              console.error("❌ Error purging old messages (cron)!");
            }
          } catch (error) {
            console.error("❌ Error checking license!");
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
          }
        }
      });
    } else {
      cron.schedule("15 0 * * *", async () => {
        try {
          await checkLicense(
            import.meta.env.MAIN_VITE_API_URL || "",
            mainWindow!
          );
          try {
            await purgeOldMessages();
          } catch (error) {
            console.error("❌ Error purging old messages (cron)!");
          }
        } catch (error) {
          console.error("❌ Error checking license!");
        }
      });
    }

    app.on("activate", function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
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
