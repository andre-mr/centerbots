import React, { useState, useEffect, useCallback } from "react";
import BotCard from "../components/BotCard";
import { Bot } from "../../models/bot-model";
import { Status } from "../../models/bot-options-model";

interface BotsProps {
  onBotDetails: (bot: Bot) => void;
  onAddBot: () => void;
  onShowGroups: (bot: Bot) => void;
  onShowMessages: (bot: Bot) => void;
}

const BotsPage: React.FC<BotsProps> = ({
  onBotDetails,
  onAddBot,
  onShowGroups,
  onShowMessages,
}) => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [botId: number]: string }>({});
  const [groupStats, setGroupStats] = useState<{
    [botId: number]: { broadcastGroups: number; broadcastMembers: number };
  }>({});
  const [messageQueues, setMessageQueues] = useState<{
    [botId: number]: any[];
  }>({});

  const fetchGroupStats = useCallback(
    async (botsList: Bot[]) => {
      const statsObj: {
        [botId: number]: { broadcastGroups: number; broadcastMembers: number };
      } = {};
      await Promise.all(
        botsList.map(async (bot) => {
          try {
            const stats = await window.appApi.getGroupsAndMembersStats(bot.Id);
            statsObj[bot.Id] = stats;
          } catch {
            statsObj[bot.Id] = { broadcastGroups: 0, broadcastMembers: 0 };
          }
        })
      );
      setGroupStats(statsObj);
    },
    [setGroupStats]
  );

  const mergeBotsWithMemory = (dbBots: Bot[], memoryBots: Bot[]): Bot[] => {
    const memoryMap = new Map(memoryBots.map((b) => [b.Id, b]));
    return dbBots.map((dbBot) => {
      const memBot = memoryMap.get(dbBot.Id);
      if (memBot) {
        return {
          ...dbBot,
          Status: memBot.Status,
          Active: memBot.Active,
          Paused: memBot.Paused,
          sendingMessageInfo: memBot.sendingMessageInfo,
        };
      }
      return dbBot;
    });
  };

  const fetchBots = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedBots, memoryBots] = await Promise.all([
        window.appApi.getAllBots(),
        window.appApi.getBotsMemoryState(),
      ]);
      setBots(mergeBotsWithMemory(fetchedBots, memoryBots));
      await fetchGroupStats(fetchedBots);
    } finally {
      setIsLoading(false);
    }
  }, [fetchGroupStats]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    const removeStatusUpdateListener = window.appApi.onStatusUpdate(
      (updatedBot) => {
        setBots((prevBots) =>
          prevBots.map((b) => (b.Id === updatedBot.Id ? updatedBot : b))
        );
      }
    );

    const removeQrCodeListener = window.appApi.onQrCode(({ botId, qr }) => {
      setQrCodes((prevQrCodes) => ({
        ...prevQrCodes,
        [botId]: qr,
      }));
    });

    const removeStatsListener = window.appApi.onGroupsAndMembersStatsUpdate(
      ({ botId, stats }) => {
        setGroupStats((prev) => ({ ...prev, [botId]: stats }));
      }
    );

    const removeQueueListener = window.appApi.onMessageQueueUpdate(
      ({ botId, messageQueue }) => {
        setMessageQueues((prev) => ({ ...prev, [botId]: messageQueue }));
      }
    );

    return () => {
      removeStatusUpdateListener();
      removeQrCodeListener();
      removeStatsListener();
      removeQueueListener();
    };
  }, []);

  const handleUpdateActive = async (bot: Bot, newActive: boolean) => {
    if (!newActive) {
      setQrCodes((prev) => {
        const copy = { ...prev };
        delete copy[bot.Id];
        return copy;
      });
    }
    await window.appApi.updateBotState(bot.Id, { Active: newActive });
  };

  const handleActivateAll = async () => {
    await Promise.all(
      bots
        .filter((bot) => !bot.Active)
        .map((bot) => handleUpdateActive(bot, true))
    );
  };

  const handleDeactivateAll = async () => {
    await Promise.all(
      bots
        .filter((bot) => bot.Active)
        .map((bot) => handleUpdateActive(bot, false))
    );
  };

  return (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-gray-900">
      <div className="flex flex-col justify-between">
        <div className="mb-3 flex w-full justify-between">
          <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            Bots
          </h2>
          <div className="flex gap-2">
            <button
              className="rounded-full border border-emerald-500 bg-white/60 px-3 py-1 text-sm text-emerald-700 transition hover:bg-emerald-50 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-gray-700"
              onClick={handleActivateAll}
            >
              Conectar todos
            </button>
            <button
              className="rounded-full border border-gray-400 bg-white/60 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={handleDeactivateAll}
            >
              Desconectar todos
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-2">
          {isLoading ? (
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          ) : bots.length > 0 ? (
            bots.map((bot: Bot) => (
              <BotCard
                key={bot.WaNumber}
                bot={bot}
                qrCode={qrCodes[bot.Id]}
                onDetails={() => onBotDetails(bot)}
                onUpdateActive={handleUpdateActive}
                onShowGroups={onShowGroups}
                onShowMessages={onShowMessages}
                groupStats={groupStats[bot.Id]}
                queueLength={
                  (messageQueues[bot.Id]?.length || 0) -
                  (bot.Status === Status.Sending &&
                  messageQueues[bot.Id]?.length > 0
                    ? 1
                    : 0)
                }
              />
            ))
          ) : (
            <p className="text-gray-600 dark:text-gray-300">
              Nenhum bot encontrado.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        {bots.length < 6 && (
          <button
            className="rounded-full border border-whatsapp-dark bg-white/60 px-3 py-2 text-sm text-whatsapp-dark transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-gray-700"
            onClick={onAddBot}
          >
            Adicionar Bot
          </button>
        )}
      </div>
    </div>
  );
};

export default BotsPage;
