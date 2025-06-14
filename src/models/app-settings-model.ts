import { PlanStatus, PlanTier } from "./app-settings-options-model";

class AppSettings {
  Id: number = 1;
  ApiKey: string | null = null;
  AuthToken: string | null = null;
  DarkMode: boolean = false;
  UserInfo: string | null = null;
  PlanStatus: PlanStatus = PlanStatus.Valid;
  PlanTier: PlanTier = PlanTier.Basic;
  LastChecked: string = new Date().toISOString();
}

export default AppSettings;
