import { ElectronAPI } from "@electron-toolkit/preload";
import { Bot } from "../models/bot-model";
import AppSettings from "@renderer/models/app-settings-model";
import { BotGroup } from "../models/bot-group-model";
import { Group } from "src/models/group-model";
import { Message } from "../models/message-model";

interface ExposedApi {
  getAppSettings: () => Promise<AppSettings | null>;
  updateAppSettings: (settings: AppSettings) => Promise<void>;

  createBot: (bot: Bot) => Promise<Bot[]>;
  updateBot: (bot: Bot) => Promise<Bot[]>;
  deleteBot: (botId: number) => Promise<Bot[]>;
  getAllBots: () => Promise<Bot[]>;

  getGroupsByBot: (botId: number) => Promise<Group[]>;
  getBotGroupsByBot: (botId: number) => Promise<BotGroup[]>;
  getGroupsAndMembersStats: (botId: number) => Promise<{
    totalGroups: number;
    totalMembers: number;
    broadcastGroups: number;
    broadcastMembers: number;
  }>;

  onStatusUpdate: (callback: (bot: Bot) => void) => () => void;
  onQrCode: (
    callback: (data: { botId: number; qr: string }) => void
  ) => () => void;
  onGroupsAndMembersStatsUpdate: (
    callback: (data: {
      botId: number;
      stats: { broadcastGroups: number; broadcastMembers: number };
    }) => void
  ) => () => void;

  onMessageQueueUpdate: (
    callback: (data: { botId: number; messageQueue: any[] }) => void
  ) => () => void;

  updateBotState: (botId: number, patch: Partial<Bot>) => Promise<Bot>;

  updateBotGroupsBroadcast: (
    botId: number,
    groups: BotGroup[]
  ) => Promise<void>;
  getBotsMemoryState: () => Promise<Bot[]>;
  getMessageQueue: (botId: number) => Promise<Message[]>;
  getMessagesByPeriod: (
    from: string,
    to: string,
    botId?: number
  ) => Promise<Message[]>;
  moveMessageUp: (botId: number, idx: number) => Promise<void>;
  moveMessageDown: (botId: number, idx: number) => Promise<void>;
  deleteMessageFromQueue: (botId: number, idx: number) => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    appApi: ExposedApi;
    appExit: {
      onConfirmExit: (callback: () => void) => void;
      sendExitResponse: (shouldClose: boolean) => void;
    };
    appUpdater: {
      onUpdateDownloaded: (callback: () => void) => void;
      confirmInstall: () => void;
    };
  }
}
