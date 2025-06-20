import "dotenv/config";
import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import { setupIpcHandlers } from "./ipc-handlers";
import { getWaManager } from "./wa-manager";
import { autoUpdater } from "electron-updater";
import { ipcMain } from "electron";
import cron from "node-cron";
import { purgeOldMessages } from "./db-commands";
import { checkLicense } from "./license-manager";

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

  setupIpcHandlers();

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
    const { ipcMain } = require("electron");
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
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.electron");

  mainWindow = createWindow();

  checkLicense(process.env.API_URL || "", mainWindow!);

  try {
    const purged = await purgeOldMessages(30);
    if (purged > 0) {
      console.log(`Expurgadas ${purged} mensagens antigas do banco de dados.`);
    }
  } catch (err) {
    console.error("Erro ao expurgar mensagens antigas:", err);
  }

  const waManager = getWaManager(mainWindow);

  mainWindow.webContents.once("did-finish-load", () => {
    waManager.init();
  });

  setupAutoUpdater(mainWindow);

  cron.schedule("0 1 * * *", async () => {
    try {
      await checkLicense(process.env.API_URL || "", mainWindow!);
      console.log("Licença verificada com sucesso às 1h.");
    } catch (err) {
      console.error("Erro ao verificar licença:", err);
    }
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
