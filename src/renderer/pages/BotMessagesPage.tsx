import React, { useEffect, useState } from "react";
import { Bot } from "../../models/bot-model";
import { Message } from "../../models/message-model";
import BotMessage from "../components/BotMessage";
import { FiMessageSquare } from "react-icons/fi";
import { FiFileText } from "react-icons/fi";

interface BotMessagesPageProps {
  bot: Bot;
  onBack: () => void;
}

const BotMessagesPage: React.FC<BotMessagesPageProps> = ({ bot, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [history, setHistory] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let mounted = true;

    const fetchQueue = async () => {
      setLoading(true);
      try {
        const queue = await window.appApi.getMessageQueue(bot.Id);
        if (mounted) setMessages(queue);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const now = new Date();
        const to = now.toISOString();
        const from = new Date(
          now.getTime() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const allMsgs = await window.appApi.getMessagesByPeriod(
          from,
          to,
          bot.Id
        );
        if (mounted) setHistory(allMsgs);
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };

    fetchQueue();
    fetchHistory();

    if (window.appApi.onMessageQueueUpdate) {
      removeListener = window.appApi.onMessageQueueUpdate(
        ({ botId, messageQueue }) => {
          if (botId === bot.Id) setMessages(messageQueue || []);
        }
      );
    }

    return () => {
      mounted = false;
      if (removeListener) removeListener();
    };
  }, [bot.Id, bot.WaNumber, messages.length]);

  const handleMoveUp = async (idx: number) => {
    if (idx <= 0) return;
    await window.appApi.moveMessageUp(bot.Id, idx);
  };
  const handleMoveDown = async (idx: number) => {
    if (idx >= messages.length - 1) return;
    await window.appApi.moveMessageDown(bot.Id, idx);
  };
  const handleDelete = async (idx: number) => {
    await window.appApi.deleteMessageFromQueue(bot.Id, idx);
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex flex-1 gap-6 overflow-hidden p-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between border-b pb-2 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              Fila de mensagens: {bot.Campaign || bot.WaNumber}
            </h2>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? (
              <div className="flex h-full flex-1 items-center justify-center">
                <span className="text-gray-500 dark:text-gray-300">
                  Carregando...
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-1 flex-col items-center justify-center p-2 shadow">
                <span className="mb-2 text-2xl">
                  <FiMessageSquare className="h-8 w-8 text-gray-500" />
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Nenhuma mensagem na fila.
                </span>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-2 overflow-auto rounded border bg-white p-2 shadow dark:bg-gray-800">
                {messages.map((msg, idx) => (
                  <BotMessage
                    key={msg.Id || idx}
                    msg={msg}
                    idx={idx}
                    isQueueItem={true}
                    isFirst={idx === 0}
                    onUp={() => handleMoveUp(idx)}
                    onDown={() => handleMoveDown(idx)}
                    onDelete={() => handleDelete(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between border-b pb-2 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {`Histórico recente (${history.length} mensage${
                history.length === 1 ? "m" : "ns"
              })`}
            </h2>
          </div>
          <div className="min-h-0 flex-1">
            <div className="flex h-full flex-col gap-2 overflow-auto rounded border bg-white p-2 shadow dark:bg-gray-800">
              {loadingHistory && (
                <span className="ml-2 text-sm text-gray-400">
                  Carregando...
                </span>
              )}
              {!loadingHistory && history.length === 0 && (
                <div className="flex h-full flex-1 flex-col items-center justify-center p-2 shadow">
                  <span className="mb-2 text-2xl">
                    <FiFileText className="h-8 w-8 text-gray-500" />
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    Nenhuma mensagem encontrada no histórico.
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {history.map((msg, idx) => (
                  <BotMessage
                    key={msg.Id || `history-${idx}`}
                    msg={msg}
                    idx={idx}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-end space-x-4 bg-white p-4 dark:bg-gray-900">
        <button
          className="rounded-full bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          onClick={onBack}
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default BotMessagesPage;
