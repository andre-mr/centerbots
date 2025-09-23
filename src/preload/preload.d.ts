import { ElectronAPI } from "@electron-toolkit/preload";
import { Bot } from "../models/bot-model";
import { Schedule } from "../models/schedule-model";
import AppSettings from "@renderer/models/app-settings-model";
import { BotGroup } from "../models/bot-group-model";
import { Group } from "src/models/group-model";
import { Message } from "../models/message-model";
import { GlobalStats } from "../models/global-stats";

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
  moveMessageToTop: (botId: number, idx: number) => Promise<void>;
  deleteMessageFromQueue: (botId: number, idx: number) => Promise<void>;
  getGlobalStats: () => Promise<GlobalStats>;

  // backup
  createBackup: () => Promise<
    | { ok: true; path: string }
    | { ok: false; error?: string; canceled?: boolean }
  >;
  restoreBackupHot: () => Promise<
    { ok: true } | { ok: false; error?: string; canceled?: boolean }
  >;

  // schedules
  getAllSchedulesLite: () => Promise<
    {
      Id: number;
      Description: string;
      Created: string;
      LastRun: string;
      BotIds: number[];
      HasOnce: boolean;
      HasDaily: boolean;
      HasWeekly: boolean;
      HasMonthly: boolean;
      Once: {
        Year: number;
        Month: number;
        Day: number;
        Hour: number;
        Minute: number;
      } | null;
      Daily: { Hour: number; Minute: number } | null;
      Weekly: { Days: number[]; Hour: number; Minute: number } | null;
      Monthly: { Dates: number[]; Hour: number; Minute: number } | null;
    }[]
  >;
  getScheduleById: (id: number) => Promise<Schedule | null>;
  createSchedule: (
    schedule: Omit<Schedule, "Images"> & {
      ImagesBase64?: (string | null)[];
      VideosBase64?: Array<string | { Base64: string; Ext?: string }>;
    }
  ) => Promise<number>;
  updateSchedule: (
    schedule: Omit<Schedule, "Images"> & {
      ImagesBase64?: (string | null)[];
      VideosBase64?: Array<string | { Base64: string; Ext?: string }>;
      RemovedMediaRelPaths?: string[];
    }
  ) => Promise<boolean>;
  deleteSchedule: (id: number) => Promise<boolean>;

  // media
  getMediaDataUrl: (relPath: string) => Promise<string | null>;

  onLicenseInvalid: (callback: () => void) => () => void;
  onLicenseGrace: (callback: () => void) => () => void;
  onLicenseValid: (callback: () => void) => () => void;
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
