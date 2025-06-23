import {
  getAppSettings,
  updateAppSettings,
  getDatabaseBackup,
} from "./db-commands";
import AppSettings from "../models/app-settings-model";
import os from "os";
import crypto from "crypto";
import { PlanStatus, PlanTier } from "../models/app-settings-options-model";

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
    console.log("[License] Iniciando verificação de licença...");
    if (!apiUrl) {
      console.warn("[License] apiUrl não informado. Licença inválida.");
      mainWindow.webContents.send("license:invalid");
      return;
    }

    let appSettings: AppSettings | null = await getAppSettings();
    if (!appSettings) {
      console.error("[License] Não foi possível obter settings do app.");
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
    if (changed) {
      await updateAppSettings(appSettings);
      console.log("[License] MachineId/Platform atualizados nos settings.");
    }

    const backupData = await getDatabaseBackup();
    const payload = {
      appSettings,
      backupData,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log("[License] Resposta da API de licença:", result);

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
        console.log("[License] Settings atualizados com dados da licença.");
      }
    } else {
      appSettings.PlanStatus = PlanStatus.Invalid;
      appSettings.PlanTier = PlanTier.Basic;
      await updateAppSettings(appSettings);
      console.error(
        "[License] Resposta da API não trouxe campos obrigatórios. Forçando status inválido no banco.",
        result
      );
      mainWindow.webContents.send("license:invalid");
      return;
    }

    if (planStatus === "Grace") {
      console.warn("[License] Licença em período de carência (Grace).");
      mainWindow.webContents.send("license:grace");
      return;
    }
    if (planStatus === "Invalid") {
      console.error("[License] Licença inválida.");
      mainWindow.webContents.send("license:invalid");
      return;
    }
    console.log("[License] Licença válida.");
    mainWindow.webContents.send("license:valid");
  } catch (err) {
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
            "[License] Erro ao checar licença. Última validação há mais de 30 dias. Forçando status INVALID.",
            err
          );
          mainWindow.webContents.send("license:invalid");
        } else if (diffDays > 7) {
          settings.PlanStatus = PlanStatus.GracePeriod;
          await updateAppSettings(settings);
          console.warn(
            "[License] Erro ao checar licença. Última validação há mais de 7 dias. Forçando status GRACE.",
            err
          );
          mainWindow.webContents.send("license:grace");
        } else {
          console.warn(
            "[License] Erro ao checar licença. Última validação há menos de 7 dias. Mantendo status atual.",
            err
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
    } catch (e) {
      console.error("[License] Erro ao forçar status após erro de licença:", e);
      mainWindow.webContents.send("license:invalid");
    }
  }
}
