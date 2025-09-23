import { Message } from "../models/message-model";
import { Schedule } from "../models/schedule-model";
import { Bot } from "../models/bot-model";
import { Status } from "../models/bot-options-model";
import {
  createMessage,
  getScheduleById,
  getSchedulesForDate,
  updateScheduleLastRun,
} from "./db-commands";
import { logger } from "./logger";
import sharp from "sharp";
import fs from "fs";
import { resolveAbsolutePath, inferKindFromPath } from "./media-storage";

type LiteSchedule = {
  Id: number;
  BotIds: number[];
  Times: number[]; // minutes since 00:00 for today
  LastRun: string; // ISO
};

let todaysKey: string = "";
let todaysSchedules: Map<number, LiteSchedule> = new Map();

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(hour: number | undefined, minute: number | undefined) {
  if (typeof hour !== "number" || typeof minute !== "number") return null;
  return hour * 60 + minute;
}

function computeTimesForToday(s: Schedule, today: Date): number[] {
  const result: number[] = [];
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const dowIndex = today.getDay();
  // 0 = Sunday ... 6 = Saturday

  if (
    s.Once &&
    s.Once.Month === m &&
    s.Once.Day === d &&
    s.Once.Year === today.getFullYear()
  ) {
    const min = timeToMinutes(s.Once.Hour, s.Once.Minute);
    if (min !== null) result.push(min);
  }
  if (s.Daily) {
    const min = timeToMinutes(s.Daily.Hour, s.Daily.Minute);
    if (min !== null) result.push(min);
  }
  if (
    s.Weekly &&
    Array.isArray(s.Weekly.Days) &&
    s.Weekly.Days.includes(dowIndex)
  ) {
    const min = timeToMinutes(s.Weekly.Hour, s.Weekly.Minute);
    if (min !== null) result.push(min);
  }
  if (
    s.Monthly &&
    Array.isArray(s.Monthly.Dates) &&
    s.Monthly.Dates.includes(d)
  ) {
    const min = timeToMinutes(s.Monthly.Hour, s.Monthly.Minute);
    if (min !== null) result.push(min);
  }
  // ensure uniqueness
  return [...new Set(result)].sort((a, b) => a - b);
}

export async function loadSchedulesForToday(baseDate?: Date) {
  const now = baseDate ? new Date(baseDate) : new Date();
  todaysKey = dateKey(now);
  todaysSchedules.clear();
  const schedules = await getSchedulesForDate(now);
  for (const s of schedules) {
    const times = computeTimesForToday(s, now);
    if (times.length === 0) continue;
    todaysSchedules.set(s.Id, {
      Id: s.Id,
      BotIds: s.BotIds,
      Times: times,
      LastRun: s.LastRun || "",
    });
  }
}

export async function maybeRefreshAtMidnight(now: Date) {
  const key = dateKey(now);
  if (key !== todaysKey && now.getHours() === 0 && now.getMinutes() === 0) {
    try {
      await loadSchedulesForToday(now);
    } catch (error) {
      console.error("❌ Error loading schedules at midnight:", error);
      logger.error("❌ Error loading schedules at midnight:", error);
    }
  }
}

export async function tickSchedules(
  now: Date,
  waManager: {
    enqueueMessage: (botId: number, message: Message) => void;
    getBots: () => Bot[];
  }
) {
  const key = dateKey(now);
  if (!todaysKey || todaysKey !== key) {
    // initialization or date changed without exact midnight match
    try {
      await loadSchedulesForToday(now);
    } catch (error) {
      console.error("❌ Error loading schedules (tick init):", error);
      logger.error("❌ Error loading schedules (tick init):", error);
      return;
    }
  }

  const minuteNow = minutesOfDay(now);

  for (const [id, lite] of [...todaysSchedules.entries()]) {
    // Determine if a run is due now or overdue, with 10-minute grace window
    // Only consider times up to now and not older than 10 minutes
    const dueTimes = lite.Times.filter(
      (t) => t <= minuteNow && minuteNow - t <= 10
    );
    if (dueTimes.length === 0) {
      // If there are past times older than 10 minutes that were not executed,
      // drop them (or the whole schedule if no future times) to avoid re-evaluating each tick.
      const missedTimes = lite.Times.filter((t) => t < minuteNow - 10);
      if (missedTimes.length > 0) {
        let executedForMissed = false;
        if (lite.LastRun) {
          const lr = new Date(lite.LastRun);
          if (
            lr.getFullYear() === now.getFullYear() &&
            lr.getMonth() === now.getMonth() &&
            lr.getDate() === now.getDate()
          ) {
            const lastRunMin = minutesOfDay(lr);
            const lastMissed = Math.max(...missedTimes);
            if (lastRunMin >= lastMissed) executedForMissed = true;
          }
        }

        if (!executedForMissed) {
          const futureTimes = lite.Times.filter((t) => t > minuteNow);
          if (futureTimes.length > 0) {
            lite.Times = futureTimes;
            todaysSchedules.set(id, lite);
          } else {
            todaysSchedules.delete(id);
          }
        }
      }
      continue; // not time yet
    }
    const lastDue = Math.max(...dueTimes);

    // If already ran at or after the lastDue, skip
    if (lite.LastRun) {
      const lr = new Date(lite.LastRun);
      if (
        lr.getFullYear() === now.getFullYear() &&
        lr.getMonth() === now.getMonth() &&
        lr.getDate() === now.getDate()
      ) {
        const lastRunMin = minutesOfDay(lr);
        if (lastRunMin >= lastDue) {
          continue;
        }
      }
    }

    // Before preparing the message, check eligible bots from WaManager
    const allBots = waManager.getBots?.() ?? [];
    const eligibleBotIds = (lite.BotIds || []).filter((botId) => {
      const bot = allBots.find((b) => b.Id === botId);
      return (
        !!bot &&
        bot.Active === true &&
        bot.Status !== Status.Offline &&
        bot.Status !== Status.LoggedOut
      );
    });

    // If no eligible bots, skip this schedule run entirely
    if (!eligibleBotIds.length) {
      continue;
    }

    try {
      // Load full schedule including Medias (disk paths)
      const full = await getScheduleById(id);
      if (!full) continue;

      // Pick randomized content for this run
      const availableContents = (full.Contents || []).map((c) =>
        (c ?? "").toString()
      );
      const nonEmptyContents = availableContents.filter(
        (c) => c.trim().length > 0
      );
      const chosenContent =
        nonEmptyContents.length > 0
          ? nonEmptyContents[
              Math.floor(Math.random() * nonEmptyContents.length)
            ]
          : null;

      // Choose ONE random media across all kinds (image or video)
      const medias: string[] = Array.isArray(full.Medias) ? full.Medias : [];
      let chosenVideo: Buffer | null = null;
      let chosenImage: Buffer | null = null;
      let thumbBase64: string | null = null;

      if (medias.length > 0) {
        // Attempt up to medias.length times to find an existing file
        const startIndex = Math.floor(Math.random() * medias.length);
        for (let i = 0; i < medias.length; i++) {
          const rel = medias[(startIndex + i) % medias.length];
          try {
            const abs = resolveAbsolutePath(rel);
            if (!fs.existsSync(abs)) continue;

            const kind = inferKindFromPath(rel);
            if (kind === "video") {
              chosenVideo = fs.readFileSync(abs);
            } else {
              const raw = fs.readFileSync(abs);
              // Light processing: resize to safe width and JPEG for WA
              chosenImage = await sharp(raw)
                .resize({ width: 600, fit: "inside" })
                .flatten({ background: "#ffffff" })
                .jpeg({ quality: 95 })
                .toBuffer();
              const thumb = await sharp(raw)
                .resize({ width: 300, height: 300, fit: "inside" })
                .flatten({ background: "#ffffff" })
                .jpeg({ quality: 50 })
                .toBuffer();
              thumbBase64 = thumb.toString("base64");
            }
            // we selected a valid media – stop searching
            break;
          } catch {}
        }
      }

      // Build message: Video takes precedence; wa-manager also prioritizes Video when present
      const msg = new Message(
        0,
        chosenContent,
        now.toISOString(),
        null,
        null,
        chosenImage,
        chosenVideo,
        full.Description || "Agendamento",
        thumbBase64,
        null
      );

      const messageId = await createMessage(msg, eligibleBotIds);
      msg.Id = messageId;

      for (const botId of eligibleBotIds) {
        try {
          waManager.enqueueMessage(botId, msg);
        } catch (error) {
          console.error(`❌ Error enqueuing message to bot ${botId}:`, error);
          logger.error(`❌ Error enqueuing message to bot ${botId}:`, error);
        }
      }

      const iso = now.toISOString();
      await updateScheduleLastRun(id, iso);
      lite.LastRun = iso;

      // Remove only if no remaining times today
      const hasRemaining = lite.Times.some((t) => t > minuteNow);
      if (!hasRemaining) {
        todaysSchedules.delete(id);
      } else {
        todaysSchedules.set(id, lite);
      }
    } catch (error) {
      console.error(`❌ Error processing schedule ${id}:`, error);
      logger.error(`❌ Error processing schedule ${id}:`, error);
    }
  }
}
