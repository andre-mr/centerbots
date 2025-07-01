import React, { useEffect, useState } from "react";
import { MdDashboard, MdSettings, MdHelpOutline } from "react-icons/md";
import BotsPage from "./pages/BotsPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import BotDetailsPage from "./pages/BotDetailsPage";
import BotGroupsPage from "./pages/BotGroupsPage";
import { Bot } from "../models/bot-model";
import {
  Status,
  WhatsAppSources,
  SendMethods,
  LinkParameters,
} from "../models/bot-options-model";
import { useSettings } from "./contexts/SettingsContext";
import BotMessagesPage from "./pages/BotMessagesPage";
import { PlanStatus } from "../models/app-settings-options-model";

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState("bots");
  const [showBotDetails, setShowBotDetails] = useState(false);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showBotGroups, setShowBotGroups] = useState(false);
  const [showBotMessages, setShowBotMessages] = useState(false);
  const [botForGroups, setBotForGroups] = useState<Bot | null>(null);
  const [botForMessages, setBotForMessages] = useState<Bot | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const { settings, refreshSettings } = useSettings();

  const menuItems = [
    { id: "bots", title: "Bots", icon: MdDashboard },
    { id: "settings", title: "Configurações", icon: MdSettings },
    { id: "help", title: "Ajuda", icon: MdHelpOutline },
  ];

  const handleAddNewBot = () => {
    const newBot = new Bot(
      0,
      "",
      "Novo Bot",
      WhatsAppSources.Direct,
      SendMethods.Forward,
      2,
      10,
      LinkParameters.None,
      new Date().toISOString(),
      null,
      false,
      [],
      false,
      Status.Offline,
      0
    );
    setSelectedBot(newBot);
    setIsEditing(false);
    setShowBotDetails(true);
  };

  const handleShowBotDetails = (bot: Bot) => {
    setSelectedBot(bot);
    setIsEditing(true);
    setShowBotDetails(true);
  };

  const handleCloseBotDetails = () => {
    setShowBotDetails(false);
    setSelectedBot(null);
    setIsEditing(false);
  };

  const handleShowBotGroups = (bot: Bot) => {
    setBotForGroups(bot);
    setShowBotGroups(true);
  };

  const handleShowBotMessages = (bot: Bot) => {
    setBotForMessages(bot);
    setShowBotMessages(true);
  };

  const handleCloseBotGroups = () => {
    setShowBotGroups(false);
    setBotForGroups(null);
  };

  const handleCloseBotMessages = () => {
    setShowBotMessages(false);
    setBotForMessages(null);
  };

  useEffect(() => {
    if (
      settings?.PlanStatus === PlanStatus.GracePeriod ||
      settings?.PlanStatus === PlanStatus.Invalid
    ) {
      setActiveSection("settings");
    }
  }, [settings?.PlanStatus]);

  const renderContent = () => {
    if (showBotMessages && botForMessages) {
      return (
        <BotMessagesPage bot={botForMessages} onBack={handleCloseBotMessages} />
      );
    }
    if (showBotGroups && botForGroups) {
      return <BotGroupsPage bot={botForGroups} onBack={handleCloseBotGroups} />;
    }
    if (showBotDetails && selectedBot) {
      return (
        <BotDetailsPage
          bot={selectedBot}
          onCancel={handleCloseBotDetails}
          isNew={!isEditing}
        />
      );
    }

    switch (activeSection) {
      case "bots":
        if (settings?.PlanStatus === PlanStatus.Invalid)
          return <SettingsPage />;
        return (
          <BotsPage
            onBotDetails={handleShowBotDetails}
            onAddBot={handleAddNewBot}
            onShowGroups={handleShowBotGroups}
            onShowMessages={handleShowBotMessages}
          />
        );
      case "settings":
        return <SettingsPage />;
      case "help":
        if (settings?.PlanStatus === PlanStatus.Invalid)
          return <SettingsPage />;
        return <HelpPage />;
      default:
        if (settings?.PlanStatus === PlanStatus.Invalid)
          return <SettingsPage />;
        return (
          <BotsPage
            onBotDetails={handleShowBotDetails}
            onAddBot={handleAddNewBot}
            onShowGroups={handleShowBotGroups}
            onShowMessages={handleShowBotMessages}
          />
        );
    }
  };

  useEffect(() => {
    if (settings?.DarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings?.DarkMode]);

  useEffect(() => {
    if (window.appExit) {
      window.appExit.onConfirmExit(() => {
        setShowExitModal(true);
      });
    }
  }, []);

  useEffect(() => {
    if (window.appUpdater) {
      window.appUpdater.onUpdateDownloaded(() => {
        setShowUpdateModal(true);
      });
    }
  }, []);

  useEffect(() => {
    const removeInvalid = window.appApi.onLicenseInvalid(() => {
      setActiveSection("settings");
      setShowBotDetails(false);
      setShowBotGroups(false);
      setShowBotMessages(false);
      refreshSettings();
    });
    const removeGrace = window.appApi.onLicenseGrace(() => {
      setActiveSection("settings");
      refreshSettings();
    });
    const removeValid = window.appApi.onLicenseValid(() => {
      refreshSettings();
    });
    return () => {
      removeInvalid();
      removeGrace();
      removeValid();
    };
  }, [refreshSettings]);

  const handleExitConfirm = (shouldClose: boolean) => {
    window.appExit.sendExitResponse(shouldClose);
    setShowExitModal(false);
  };

  const handleUpdateConfirm = () => {
    window.appUpdater.confirmInstall();
  };

  return (
    <>
      <div className="flex h-full w-full">
        <div className="h-full w-1/12 min-w-[200px] border-r border-gray-200 bg-gray-100 shadow-md dark:border-gray-800 dark:bg-gray-950">
          <nav>
            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`flex cursor-pointer items-center px-3 py-3 transition-colors duration-200 ${
                  activeSection === item.id
                    ? "border-r-4 border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-gray-800 dark:text-emerald-400"
                    : "text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
                onClick={() => {
                  if (settings?.PlanStatus === PlanStatus.Invalid) return;
                  setActiveSection(item.id);
                  setShowBotDetails(false);
                  setSelectedBot(null);
                  setShowBotGroups(false);
                  setBotForGroups(null);
                  setShowBotMessages(false);
                  setBotForMessages(null);
                }}
              >
                <item.icon
                  className={`mr-3 text-xl ${
                    activeSection === item.id
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                />
                <span>{item.title}</span>
              </div>
            ))}
          </nav>
        </div>
        <div className="h-full w-11/12 overflow-auto p-3 dark:bg-gray-900">
          {renderContent()}
        </div>
      </div>
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold">Confirmar saída</h2>
            <p className="mb-2">Tem certeza que deseja fechar o aplicativo?</p>
            <p className="mb-6 text-red-600 dark:text-red-400">
              Todos os bots ativos serão desconectados!
            </p>
            <div className="flex justify-between gap-2">
              <button
                className="rounded bg-gray-200 px-4 py-2"
                onClick={() => handleExitConfirm(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded bg-red-500 px-4 py-2 text-white"
                onClick={() => handleExitConfirm(true)}
              >
                Confirmar saída
              </button>
            </div>
          </div>
        </div>
      )}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold">Atualização disponível</h2>
            <p className="mb-6">
              Uma nova versão foi baixada e está pronta para ser instalada.
              <br />O aplicativo será reiniciado para concluir a atualização.
            </p>
            <div className="flex justify-between gap-2">
              <button
                className="w-60 rounded bg-gray-200 px-4 py-2"
                onClick={() => setShowUpdateModal(false)}
              >
                Cancelar e atualizar depois
              </button>
              <button
                className="w-60 rounded bg-emerald-600 px-4 py-2 text-white"
                onClick={handleUpdateConfirm}
              >
                Reiniciar e atualizar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
