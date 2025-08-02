import { PlanStatus, PlanTier } from "./app-settings-options-model";

class AppSettings {
  LicenseKey: string | null = null;
  DarkMode: boolean = false;
  UserId: string | null = null;
  PlanStatus: PlanStatus = PlanStatus.Invalid;
  PlanTier: PlanTier = PlanTier.Basic;
  RegisteredBots: (string | null)[] = [];
  Proxy: boolean = false;
  AppVersion: string = "1.1.0";
  MachineId: string | null = null;
  LastIP: string | null = null;
  LastCheckin: string = new Date().toISOString();
  LastSync: string = new Date().toISOString();
  SyncInterval: number = 0;
  Platform: string = ""; // windows, linux, darwin, etc.
}

export default AppSettings;
