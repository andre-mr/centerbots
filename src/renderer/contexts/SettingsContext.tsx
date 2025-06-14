import React, { createContext, useContext, useState, useEffect } from "react";
import AppSettings from "../../models/app-settings-model";

type SettingsContextType = {
  settings: AppSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const refreshSettings = async () => {
    const result = await window.appApi.getAppSettings();
    setSettings(result);
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, setSettings, refreshSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context)
    throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
