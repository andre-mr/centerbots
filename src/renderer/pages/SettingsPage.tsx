import React, { useState, useEffect } from "react";
import { PlanStatus, PlanTier } from "../../models/app-settings-options-model";
import { GlobalStats } from "../../models/global-stats";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiStar,
  FiAward,
  FiMessageSquare,
  FiTarget,
  FiActivity,
} from "react-icons/fi";
import { useSettings } from "../contexts/SettingsContext";

const planStatusLabels: Record<PlanStatus, string> = {
  [PlanStatus.Valid]: "Ativo",
  [PlanStatus.GracePeriod]: "Expirado",
  [PlanStatus.Invalid]: "Inativo",
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
    <FiAward className="text-amber-500 dark:text-amber-400" size={20} />
  ),
};

const SettingsPage: React.FC = () => {
  const { settings, setSettings, refreshSettings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        const fetchedStats = await window.appApi.getGlobalStats();
        setStats(fetchedStats);
      } catch (err) {
        console.error("Erro ao buscar estatísticas:", err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

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
      <div className="mb-6 flex items-start justify-between">
        <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          Configurações
        </h2>
      </div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {settings && (
        <form
          className="flex h-full flex-col justify-between gap-8"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="flex flex-col gap-8">
            {/* General Settings */}
            <div className="flex flex-col">
              <h3 className="mb-4 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Configurações Gerais
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label
                    className="font-semibold text-gray-700 dark:text-gray-200"
                    htmlFor="userInfo"
                  >
                    Identificação do usuário
                  </label>
                  <input
                    id="userInfo"
                    name="UserId"
                    type="text"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-400"
                    value={settings.UserId || ""}
                    placeholder="Ex: 5534988881111"
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="font-semibold text-gray-700 dark:text-gray-200"
                    htmlFor="apiKey"
                  >
                    Chave de acesso
                  </label>
                  <input
                    id="apiKey"
                    name="LicenseKey"
                    type="text"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-400"
                    value={settings.LicenseKey || ""}
                    placeholder="Digite sua chave"
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* License Info */}
            <div className="flex flex-col">
              <h3 className="mb-4 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Informações da Licença
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                  <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">
                    Status do Plano
                  </div>
                  <div className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
                    {planStatusIcons[settings.PlanStatus]}
                    <span className="font-medium">
                      {planStatusLabels[settings.PlanStatus]}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                  <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">
                    Tipo de Plano
                  </div>
                  <div className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
                    {planTierIcons[settings.PlanTier]}
                    <span className="font-medium">
                      {planTierLabels[settings.PlanTier]}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    Última verificação:
                  </span>
                  <span className="text-blue-800 dark:text-blue-200">
                    {new Date(settings.LastCheckin).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="flex flex-col">
              <h3 className="mb-4 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                Estatísticas do Sistema
              </h3>
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-8 text-gray-700 dark:text-gray-200">
                  <div className="mr-3 h-6 w-6 animate-spin rounded-full border-b-2 border-emerald-500"></div>
                  Carregando estatísticas...
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* System */}
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="mb-3 flex items-center gap-3">
                      <FiActivity
                        className="text-blue-600 dark:text-blue-400"
                        size={24}
                      />
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                        Sistema
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-white dark:border-gray-600">
                        <span className="whitespace-nowrap text-blue-700 dark:text-blue-300">
                          Total de Bots
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-blue-800 dark:text-blue-200">
                          {stats.totalBots}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-white dark:border-gray-600">
                        <span className="whitespace-nowrap text-blue-700 dark:text-blue-300">
                          Total de Grupos
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-blue-800 dark:text-blue-200">
                          {stats.totalGroups}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-white dark:border-gray-600">
                        <span className="whitespace-nowrap text-blue-700 dark:text-blue-300">
                          Grupos Ativos
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-blue-800 dark:text-blue-200">
                          {stats.broadcastGroups}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        {(
                          (stats.broadcastGroups / stats.totalGroups) *
                          100
                        ).toFixed(1)}
                        % do total
                      </div>
                    </div>
                  </div>

                  {/* Target */}
                  <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 dark:from-emerald-900/20 dark:to-emerald-800/20">
                    <div className="mb-3 flex items-center gap-3">
                      <FiTarget
                        className="text-emerald-600 dark:text-emerald-400"
                        size={24}
                      />
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">
                        Alcance
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-emerald-700 dark:text-emerald-300">
                          Total de Membros
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-200">
                          {stats.totalMembers.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-emerald-700 dark:text-emerald-300">
                          Membros Atingíveis
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-200">
                          {stats.broadcastMembers.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                        {(
                          (stats.broadcastMembers / stats.totalMembers) *
                          100
                        ).toFixed(1)}
                        % do total
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-4 dark:from-purple-900/20 dark:to-purple-800/20 md:col-span-2 lg:col-span-1">
                    <div className="mb-3 flex items-center gap-3">
                      <FiMessageSquare
                        className="text-purple-600 dark:text-purple-400"
                        size={24}
                      />
                      <h4 className="font-semibold text-purple-800 dark:text-purple-200">
                        Mensagens
                      </h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-purple-700 dark:text-purple-300">
                          Hoje
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-purple-800 dark:text-purple-200">
                          {stats.todayMessages.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-purple-700 dark:text-purple-300">
                          Esta Semana
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-purple-800 dark:text-purple-200">
                          {stats.weekMessages.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="whitespace-nowrap text-purple-700 dark:text-purple-300">
                          Este Mês
                        </span>
                        <span className="mx-2 w-full border-t border-white dark:border-gray-600"></span>
                        <span className="font-bold text-purple-800 dark:text-purple-200">
                          {stats.monthMessages.toLocaleString()}
                        </span>
                      </div>
                      {/* <div className="flex justify-between border-b border-white dark:border-gray-600">
                        <span className="text-purple-700 dark:text-purple-300">
                          Total Geral
                        </span>
                        <span className="font-bold text-purple-800 dark:text-purple-200">
                          {stats.totalMessages.toLocaleString()}
                        </span>
                      </div> */}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-red-50 p-4 text-center text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  Não foi possível carregar as estatísticas.
                </div>
              )}
            </div>
          </div>

          {/* Footer with controls */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                <button
                  type="button"
                  className={`relative flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                    settings.DarkMode
                      ? "bg-emerald-500"
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
                    className={`absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 dark:bg-gray-200 ${
                      settings.DarkMode ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
              <label className="font-semibold text-gray-700 dark:text-gray-200">
                Tema Escuro
              </label>
            </div>
            <button
              type="submit"
              className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
              disabled={isLoading}
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SettingsPage;
