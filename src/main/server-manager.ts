import {
  getAppSettings,
  updateAppSettings,
  getDatabaseBackup,
  getAllBots,
  getAllGroups,
  markInviteLinksAsSynced,
} from "./db-commands";
import AppSettings from "../models/app-settings-model";
import os from "os";
import crypto from "crypto";
import { PlanStatus, PlanTier } from "../models/app-settings-options-model";
import packageJson from "../../package.json";
import { logger } from "./logger";

function generateMachineId(): string {
  let parts: string[] = [];
  const hostname = os.hostname();
  const cpus = os.cpus();
  const cpuModel =
    cpus && cpus.length > 0 && cpus[0].model ? cpus[0].model : "";

  if (hostname) parts.push(hostname);
  if (cpuModel) parts.push(cpuModel);

  if (!hostname) parts.push(os.platform());
  if (!cpuModel) parts.push(os.arch());

  const raw = parts.join("-");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function checkLicense(
  apiUrl: string,
  mainWindow: Electron.BrowserWindow
) {
  try {
    if (!apiUrl) {
      console.error("❌ API URL not provided. Invalid license.");
      logger.error("❌ API URL not provided. Invalid license.");
      mainWindow.webContents.send("license:invalid");
      return;
    }

    let appSettings: AppSettings | null = await getAppSettings();
    if (!appSettings) {
      console.error("❌ Could not get app settings!");
      logger.error("❌ Could not get app settings!");
      return;
    }

    if (!appSettings.UserId) appSettings.UserId = "";
    if (!appSettings.LicenseKey) appSettings.LicenseKey = "";
    if (!appSettings.MachineId) appSettings.MachineId = generateMachineId();
    if (!appSettings.PlanStatus) appSettings.PlanStatus = PlanStatus.Invalid;
    if (!appSettings.PlanTier) appSettings.PlanTier = PlanTier.Basic;
    if (!appSettings.LastCheckin)
      appSettings.LastCheckin = new Date().toISOString();

    const machineId = generateMachineId();
    const platform = os.platform();
    let changed = false;
    if (appSettings.MachineId !== machineId) {
      appSettings.MachineId = machineId;
      changed = true;
    }
    if (appSettings.Platform !== platform) {
      appSettings.Platform = platform;
      changed = true;
    }
    if (appSettings.AppVersion !== packageJson.version) {
      appSettings.AppVersion = packageJson.version;
      changed = true;
    }

    const bots = await getAllBots();
    const botNumbers = bots.map((bot) => bot.WaNumber || "");
    if (
      JSON.stringify([...appSettings.RegisteredBots].sort()) !==
      JSON.stringify([...botNumbers].sort())
    ) {
      appSettings.RegisteredBots = botNumbers;
      changed = true;
    }

    if (changed) {
      await updateAppSettings(appSettings);
    }

    const dbBackup = await getDatabaseBackup();
    const appData = {
      ...appSettings,
      ...dbBackup,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appData }),
    });
    const result = await response.json();

    const planStatus = result.PlanStatus;

    if (result.PlanStatus && result.PlanTier && result.LastCheckin) {
      let updated = false;
      if (appSettings.PlanStatus !== result.PlanStatus) {
        appSettings.PlanStatus = result.PlanStatus;
        updated = true;
      }
      if (appSettings.PlanTier !== result.PlanTier) {
        appSettings.PlanTier = result.PlanTier;
        updated = true;
      }
      if (appSettings.LastCheckin !== result.LastCheckin) {
        appSettings.LastCheckin = result.LastCheckin;
        updated = true;
      }
      if (updated) {
        await updateAppSettings(appSettings);
      }
    } else {
      appSettings.PlanStatus = PlanStatus.Invalid;
      appSettings.PlanTier = PlanTier.Basic;
      await updateAppSettings(appSettings);
      console.error(
        "❌ API response did not return required fields. Forcing invalid status in database."
      );
      logger.error(
        "❌ API response did not return required fields. Forcing invalid status in database."
      );
      mainWindow.webContents.send("license:invalid");
      return;
    }

    if (planStatus === "Grace") {
      mainWindow.webContents.send("license:grace");
      return;
    }
    if (planStatus === "Invalid") {
      console.error("❌ Invalid license!");
      logger.error("❌ Invalid license!");
      mainWindow.webContents.send("license:invalid");
      return;
    }
    mainWindow.webContents.send("license:valid");
  } catch (error) {
    console.error("❌ Error checking license:", error);
    logger.error("❌ Error checking license:", error);
    try {
      let settings: AppSettings | null = await getAppSettings();
      if (settings) {
        const now = new Date();
        const lastCheckin = new Date(settings.LastCheckin);
        const diffMs = now.getTime() - lastCheckin.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays > 30) {
          settings.PlanStatus = PlanStatus.Invalid;
          settings.PlanTier = PlanTier.Basic;
          await updateAppSettings(settings);
          console.error(
            "❌ Error checking license. Last validation more than 30 days. Forcing INVALID status."
          );
          logger.error(
            "❌ Error checking license. Last validation more than 30 days. Forcing INVALID status."
          );
          mainWindow.webContents.send("license:invalid");
        } else if (diffDays > 7) {
          settings.PlanStatus = PlanStatus.GracePeriod;
          await updateAppSettings(settings);
          console.error(
            "❌ Error checking license. Last validation more than 7 days. Forcing GRACE status."
          );
          logger.error(
            "❌ Error checking license. Last validation more than 7 days. Forcing GRACE status."
          );
          mainWindow.webContents.send("license:grace");
        } else {
          console.error(
            "❌ Error checking license. Last validation less than 7 days. Keeping current status."
          );
          logger.error(
            "❌ Error checking license. Last validation less than 7 days. Keeping current status."
          );
          if (settings.PlanStatus === PlanStatus.GracePeriod) {
            mainWindow.webContents.send("license:grace");
          } else if (settings.PlanStatus === PlanStatus.Invalid) {
            mainWindow.webContents.send("license:invalid");
          } else {
            mainWindow.webContents.send("license:valid");
          }
        }
      }
    } catch (error) {
      console.error("❌ Error forcing status after license error!", error);
      logger.error("❌ Error forcing status after license error!", error);
      mainWindow.webContents.send("license:invalid");
    }
  }
}

export async function sendSyncData(
  apiUrl: string,
  botsData?: any[],
  syncGroups: boolean = false
): Promise<void> {
  try {
    if (!apiUrl) {
      console.error("❌ API URL not provided. Skipping sync.");
      logger.error("❌ API URL not provided. Skipping sync.");
      return;
    }

    const appSettings = await getAppSettings();
    if (!appSettings) {
      console.error("❌ Could not get app settings for sync!");
      logger.error("❌ Could not get app settings for sync!");
      return;
    }

    const userData = {
      UserId: appSettings.UserId,
      LicenseKey: appSettings.LicenseKey,
    };

    if (botsData && botsData.length > 0) {
      const payload = {
        userData,
        botsData,
      };
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
        } else {
          console.error(
            `❌ Failed to send bots data. Status: ${response.status}`
          );
          logger.error(
            `❌ Failed to send bots data. Status: ${response.status}`
          );
        }
      } catch (error) {
        console.error("❌ Error sending bots data:", error);
        logger.error("❌ Error sending bots data:", error);
      }
    }

    if (!syncGroups) {
      return;
    }

    const allGroups = await getAllGroups();
    const lastSync = appSettings.LastSync
      ? new Date(appSettings.LastSync)
      : null;
    const now = new Date();
    let includeAll = false;

    if (!lastSync || now.getTime() - lastSync.getTime() > 24 * 60 * 60 * 1000) {
      includeAll = true;
    }

    const groupsToSync = allGroups.filter((group) => {
      if (includeAll) return true;
      if (!group.Updated) return true;
      const updatedDate = new Date(group.Updated);
      return lastSync ? updatedDate > lastSync : true;
    });

    if (groupsToSync.length === 0) {
      return;
    }

    const groupsData = groupsToSync.map((g) => ({
      GroupJid: g.GroupJid,
      InviteLink: g.InviteLink.endsWith(":sync") ? "" : g.InviteLink,
      Members: g.TotalMembers,
      Name: g.Name,
      Updated: g.Updated,
    }));

    const BATCH_SIZE = 100;
    let allBatchesOk = true;
    for (let i = 0; i < groupsData.length; i += BATCH_SIZE) {
      const batch = groupsData.slice(i, i + BATCH_SIZE);
      const payload = {
        userData,
        groupsData: batch,
      };

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const batchJids = new Set(batch.map((b) => b.GroupJid));
          const originalGroupsInBatch = groupsToSync.filter((g) =>
            batchJids.has(g.GroupJid)
          );

          const groupsToUpdate = originalGroupsInBatch.filter(
            (g) => g.InviteLink && !g.InviteLink.endsWith(":sync")
          );

          if (groupsToUpdate.length > 0) {
            try {
              const groupIdsToUpdate = groupsToUpdate.map((g) => g.Id);
              await markInviteLinksAsSynced(groupIdsToUpdate);
            } catch (dbErr) {
              console.error("❌ Error bulk updating groups after sync:", dbErr);
              logger.error("❌ Error bulk updating groups after sync:", dbErr);
            }
          }
        } else {
          allBatchesOk = false;
          console.error(
            `❌ Failed to send groups data. Status: ${response.status} (batch ${
              Math.floor(i / BATCH_SIZE) + 1
            })`
          );
          logger.error(
            `❌ Failed to send groups data. Status: ${response.status} (batch ${
              Math.floor(i / BATCH_SIZE) + 1
            })`
          );
        }
      } catch (batchError) {
        allBatchesOk = false;
        console.error(
          `❌ Error sending groups batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          batchError
        );
        logger.error(
          `❌ Error sending groups batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          batchError
        );
      }

      if (i + BATCH_SIZE < groupsData.length) {
        await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
      }
    }

    if (allBatchesOk) {
      appSettings.LastSync = new Date().toISOString();
      await updateAppSettings(appSettings);
    } else {
      console.error("❌ Groups sync finished with errors.");
      logger.error("❌ Groups sync finished with errors.");
    }
  } catch (error) {
    console.error("❌ Error during sync process:", error);
    logger.error("❌ Error during sync process:", error);
  }
}
