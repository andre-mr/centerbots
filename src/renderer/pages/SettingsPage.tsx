import React, { useState } from "react";
import { PlanStatus, PlanTier } from "../../models/app-settings-options-model";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiStar,
  FiAward,
} from "react-icons/fi";
import { useSettings } from "../contexts/SettingsContext";

const planStatusLabels: Record<PlanStatus, string> = {
  [PlanStatus.Valid]: "Válido",
  [PlanStatus.GracePeriod]: "Expirado",
  [PlanStatus.Invalid]: "Inválido",
};

const planTierLabels: Record<PlanTier, string> = {
  [PlanTier.Basic]: "Básico",
  [PlanTier.Full]: "Completo",
};

const planStatusIcons: Record<PlanStatus, React.JSX.Element> = {
  [PlanStatus.Valid]: (
    <FiCheckCircle className="text-green-600 dark:text-green-500" size={20} />
  ),
  [PlanStatus.GracePeriod]: (
    <FiAlertCircle
      className="animate-pulse text-yellow-500 dark:text-yellow-300"
      size={20}
    />
  ),
  [PlanStatus.Invalid]: <FiXCircle className="text-red-500" size={20} />,
};

const planTierIcons: Record<PlanTier, React.JSX.Element> = {
  [PlanTier.Basic]: (
    <FiStar className="text-blue-500 dark:text-blue-300" size={20} />
  ),
  [PlanTier.Full]: (
    <FiAward className="text-emerald-600 dark:text-emerald-400" size={20} />
  ),
};

const SettingsPage: React.FC = () => {
  const { settings, setSettings, refreshSettings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let newValue: any = value;
    if (type === "checkbox" && e.target instanceof HTMLInputElement) {
      newValue = e.target.checked;
    }
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            [name]: newValue,
          }
        : prev
    );
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsLoading(true);
    setError(null);
    try {
      await window.appApi.updateAppSettings(settings);
      await refreshSettings();
      setError(null);
    } catch (err) {
      setError("Erro ao salvar configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !settings) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          Configurações
        </h2>
      </div>
      {error && (
        <div className="mb-2 text-red-500 dark:text-red-400">{error}</div>
      )}
      {settings && (
        <form
          className="flex h-full flex-col justify-between gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="flex flex-col">
            {/* Configurações Gerais */}
            <div className="flex flex-col">
              <h3 className="mb-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Geral
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    className="font-semibold text-gray-700 dark:text-gray-200"
                    htmlFor="userInfo"
                  >
                    Identificação do usuário
                  </label>
                  <input
                    id="userInfo"
                    name="UserInfo"
                    type="text"
                    className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
                    value={settings.UserInfo || ""}
                    placeholder="Ex: 5534988881111"
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="font-semibold text-gray-700 dark:text-gray-200"
                    htmlFor="apiKey"
                  >
                    Chave de acesso
                  </label>
                  <input
                    id="apiKey"
                    name="ApiKey"
                    type="text"
                    className="rounded border bg-white px-2 py-2 dark:bg-gray-800 dark:text-gray-100"
                    value={settings.ApiKey || ""}
                    placeholder="Digite sua chave"
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Informações de Licença */}
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="mb-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Licença
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">
                    Situação do plano
                  </div>
                  <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    {planStatusIcons[settings.PlanStatus]}
                    {planStatusLabels[settings.PlanStatus]}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">
                    Tipo de plano
                  </div>
                  <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    {planTierIcons[settings.PlanTier]}
                    {planTierLabels[settings.PlanTier]}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm italic">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    Última verificação:
                  </span>
                  <span className="text-gray-800 dark:text-gray-100">
                    {new Date(settings.LastChecked).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <div className="flex items-center">
              <div className="flex h-full items-center">
                <button
                  type="button"
                  className={`relative flex h-6 w-10 items-center rounded-full transition-colors duration-200 ${
                    settings.DarkMode
                      ? "bg-blue-500"
                      : "bg-gray-300 dark:bg-gray-700"
                  }`}
                  onClick={() =>
                    setSettings((prev) =>
                      prev ? { ...prev, DarkMode: !prev.DarkMode } : prev
                    )
                  }
                  aria-label={
                    settings.DarkMode
                      ? "Desativar modo escuro"
                      : "Ativar modo escuro"
                  }
                >
                  <span
                    className={`absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 dark:bg-gray-200 ${
                      settings.DarkMode ? "translate-x-4" : ""
                    } `}
                  />
                </button>
              </div>
              <label
                className="ml-3 font-semibold text-gray-700 dark:text-gray-200"
                htmlFor="darkMode"
              >
                Modo escuro
              </label>
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                disabled={isLoading}
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default SettingsPage;
