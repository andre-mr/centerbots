import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { Bot } from "../models/bot-model";

const exposedApi = {
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  updateAppSettings: (settings: any) =>
    ipcRenderer.invoke("settings:update", settings),

  createBot: (bot: Bot) => ipcRenderer.invoke("bots:create", bot),
  updateBot: (bot: Bot) => ipcRenderer.invoke("bots:update", bot),
  deleteBot: (botId: number) => ipcRenderer.invoke("bots:delete", botId),
  getAllBots: () => ipcRenderer.invoke("bots:getAll"),
  getGroupsByBot: (botId: number) =>
    ipcRenderer.invoke("bots:getGroupsByBot", botId),
  getBotGroupsByBot: (botId: number) =>
    ipcRenderer.invoke("bots:getBotGroupsByBot", botId),
  getGroupsAndMembersStats: (botId: number) =>
    ipcRenderer.invoke("bots:getGroupsAndMembersStats", botId),
  getBotsMemoryState: () => ipcRenderer.invoke("bots:getMemoryState"),
  getMessageQueue: (botId: number) =>
    ipcRenderer.invoke("bots:getMessageQueue", botId),
  getMessagesByPeriod: (from: string, to: string, botId?: number) =>
    ipcRenderer.invoke("messages:getByPeriod", from, to, botId),
  moveMessageUp: (botId: number, idx: number) =>
    ipcRenderer.invoke("bots:moveMessageUp", botId, idx),
  moveMessageDown: (botId: number, idx: number) =>
    ipcRenderer.invoke("bots:moveMessageDown", botId, idx),
  deleteMessageFromQueue: (botId: number, idx: number) =>
    ipcRenderer.invoke("bots:deleteMessageFromQueue", botId, idx),

  onStatusUpdate: (callback: (bot: Bot) => void) => {
    const handler = (_event: any, bot: Bot) => callback(bot);
    ipcRenderer.on("bot:statusUpdate", handler);
    return () => ipcRenderer.removeListener("bot:statusUpdate", handler);
  },
  onQrCode: (callback: (data: { botId: number; qr: string }) => void) => {
    const handler = (_event: any, data: { botId: number; qr: string }) =>
      callback(data);
    ipcRenderer.on("bot:qrCode", handler);
    return () => ipcRenderer.removeListener("bot:qrCode", handler);
  },
  onGroupsAndMembersStatsUpdate: (
    callback: (data: {
      botId: number;
      stats: { broadcastGroups: number; broadcastMembers: number };
    }) => void
  ) => {
    const handler = (_event: any, data: { botId: number; stats: any }) =>
      callback(data);
    ipcRenderer.on("bot:groupsAndMembersStatsUpdate", handler);
    return () =>
      ipcRenderer.removeListener("bot:groupsAndMembersStatsUpdate", handler);
  },
  onMessageQueueUpdate: (
    callback: (data: { botId: number; messageQueue: any[] }) => void
  ) => {
    const handler = (
      _event: any,
      data: { botId: number; messageQueue: any[] }
    ) => callback(data);
    ipcRenderer.on("bot:messageQueueUpdate", handler);
    return () => ipcRenderer.removeListener("bot:messageQueueUpdate", handler);
  },

  updateBotState: (botId: number, patch: Partial<Bot>) =>
    ipcRenderer.invoke("bots:updateBotState", botId, patch),

  updateBotGroupsBroadcast: (botId: number, groups: any[]) =>
    ipcRenderer.invoke("bots:updateBotGroupsBroadcast", botId, groups),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("appApi", exposedApi);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.appApi = exposedApi;
}

contextBridge.exposeInMainWorld("appExit", {
  onConfirmExit: (callback: () => void) => {
    ipcRenderer.on("app:confirm-exit", callback);
  },
  sendExitResponse: (shouldClose: boolean) => {
    ipcRenderer.send("app:confirm-exit-response", shouldClose);
  },
});
