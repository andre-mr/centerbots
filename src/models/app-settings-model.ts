import { PlanStatus, PlanTier } from "./app-settings-options-model";

class AppSettings {
  LicenseKey: string | null = null;
  DarkMode: boolean = false;
  UserId: string | null = null;
  PlanStatus: PlanStatus = PlanStatus.Invalid;
  PlanTier: PlanTier = PlanTier.Basic;
  RegisteredBots: string[] = [];
  AppVersion: string = "1.0.0";
  MachineId: string | null = null;
  LastIP: string | null = null;
  LastCheckin: string = new Date().toISOString();
  Platform: string = ""; // windows, linux, darwin, etc.
}

export default AppSettings;
