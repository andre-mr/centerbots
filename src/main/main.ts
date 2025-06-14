import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { checkEmptyDatabaseAndSeed } from "./db-mock";
import { setupIpcHandlers } from "./ipc-handlers";
import { dbReady } from "./db-connection";
import { getWaManager } from "./wa-manager";

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

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const mainWindow = createWindow();
  const waManager = getWaManager(mainWindow);

  mainWindow.webContents.once("did-finish-load", () => {
    waManager.init();
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  dbReady.then(() => {
    checkEmptyDatabaseAndSeed().then((isEmpty) => {
      if (isEmpty) {
        console.log("✅ Database is empty. Mock data seeded.");
      } else {
        // console.log("❌ Database is not empty. No mock data seeded.");
      }
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
