import React from "react";
import { Bot } from "../../models/bot-model";
import { Status } from "../../models/bot-options-model";
import {
  MdCheckCircle,
  MdError,
  MdPowerSettingsNew,
  MdHighlightOff,
  MdPauseCircleFilled,
  MdPlayCircleFilled,
} from "react-icons/md";
import { IoSync } from "react-icons/io5";
import { QRCodeCanvas } from "qrcode.react";

interface BotProps {
  bot: Bot;
  qrCode?: string;
  onDetails?: () => void;
  onUpdateActive?: (bot: Bot, newActive: boolean) => void;
  onShowGroups?: (bot: Bot) => void;
  onShowMessages: (bot: Bot) => void;
}

const statusIcon = (status: Status) => {
  switch (status) {
    case Status.Online:
      return (
        <MdCheckCircle
          className="text-3xl text-green-500 dark:text-green-400"
          title="Online"
        />
      );
    case Status.Sending:
      return (
        <IoSync
          className="animate-spin text-3xl text-blue-500 dark:text-blue-400"
          title="Enviando"
        />
      );
    case Status.Disconnected:
      return (
        <MdHighlightOff
          className="animate-pulse text-3xl text-yellow-500 dark:text-yellow-400"
          title="Desconectado"
        />
      );
    case Status.LoggedOut:
      return (
        <span className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-red-400 opacity-60"></span>
          <MdError
            className="relative text-3xl text-red-500 dark:text-red-400"
            title="Deslogado"
          />
        </span>
      );
    case Status.Offline:
    default:
      return (
        <MdPowerSettingsNew
          className="text-3xl text-gray-400 dark:text-gray-500"
          title="Offline"
        />
      );
  }
};

const BotCard: React.FC<
  BotProps & {
    groupStats?: { broadcastGroups: number; broadcastMembers: number };
    messageStats?: { broadcastGroups: number; broadcastMembers: number };
  }
> = ({
  bot,
  qrCode,
  onDetails,
  onUpdateActive,
  onShowGroups,
  onShowMessages,
  groupStats,
}) => {
  const handleToggleState = async () => {
    if (onUpdateActive) {
      await window.appApi.updateBotState(bot.Id, { Active: !bot.Active });
    }
  };

  const handlePauseResume = async () => {
    if (onUpdateActive) {
      await window.appApi.updateBotState(bot.Id, { Paused: !bot.Paused });
    }
  };

  return (
    <div
      className={`flex flex-col rounded-lg border-2 transition-shadow duration-200 ${
        bot.Active
          ? "bg-white shadow hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-md dark:hover:shadow-emerald-900/50"
          : "bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <div className="flex items-center justify-between border-b bg-teal-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-900">
        <button
          className={`relative flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${
            bot.Active !== false
              ? "bg-blue-500 dark:bg-blue-600"
              : "bg-gray-300 dark:bg-gray-700"
          }`}
          onClick={handleToggleState}
          aria-label={bot.Active !== false ? "Desativar bot" : "Ativar bot"}
        >
          <span
            className={`absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 dark:bg-gray-200 ${bot.Active !== false ? "translate-x-4" : ""} `}
          />
        </button>

        <button
          className={`flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-semibold transition-colors duration-200 ${
            bot.Active === true
              ? bot.Paused
                ? "animate-pulse bg-yellow-400 text-yellow-900 hover:bg-yellow-500 dark:bg-yellow-500 dark:text-yellow-900 dark:hover:bg-yellow-400"
                : "bg-gray-200 text-gray-700 hover:bg-yellow-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-yellow-600"
              : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          }`}
          onClick={handlePauseResume}
          disabled={bot.Active === false}
          aria-label={bot.Paused ? "Retomar bot" : "Pausar bot"}
        >
          {bot.Paused ? (
            <>
              <MdPlayCircleFilled className="text-lg" />
              Retomar
            </>
          ) : (
            <>
              <MdPauseCircleFilled className="text-lg" />
              Pausar
            </>
          )}
        </button>
      </div>
      <div className="flex items-center justify-between px-2 py-0.5">
        <div className="flex items-center gap-4">
          <span>{statusIcon(bot.Status)}</span>
          <div>
            <div className="text-lg font-bold text-whatsapp-teal dark:text-whatsapp">
              {bot.Campaign || "Bot sem nome"}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 xl:text-xs">
              {bot.WaNumber
                ? bot.WaNumber.length === 13
                  ? `${bot.WaNumber.slice(0, 2)} ${bot.WaNumber.slice(2, 4)} ${bot.WaNumber.slice(4, 9)} ${bot.WaNumber.slice(9)}`
                  : bot.WaNumber.length === 12
                    ? `${bot.WaNumber.slice(0, 2)} ${bot.WaNumber.slice(2, 4)} ${bot.WaNumber.slice(4, 8)} ${bot.WaNumber.slice(8)}`
                    : bot.WaNumber
                : "S/N"}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <button
            className="w-full rounded-full border-2 border-emerald-400 bg-white/40 px-3 py-0.5 text-sm text-emerald-700 backdrop-blur transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-gray-800/60 dark:text-emerald-400 dark:hover:bg-gray-700"
            onClick={onDetails}
          >
            Configurar
          </button>
        </div>
      </div>
      {groupStats && onShowGroups && (
        <div className="flex items-center justify-between border-t px-2 py-1 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span>
              {groupStats.broadcastGroups}{" "}
              {groupStats.broadcastGroups === 1 ? "grupo" : "grupos"},{" "}
            </span>
            <span>
              {groupStats.broadcastMembers}{" "}
              {groupStats.broadcastMembers === 1 ? "membro" : "membros"}
            </span>
          </div>
          <button
            className="rounded-full border-2 border-sky-400 bg-white/40 px-3 py-0.5 text-sm text-sky-700 backdrop-blur transition hover:bg-sky-50 dark:border-sky-500 dark:bg-gray-800/60 dark:text-sky-400 dark:hover:bg-gray-700 xl:py-0"
            onClick={() => onShowGroups(bot)}
          >
            Grupos
          </button>
        </div>
      )}
      {
        <div className="flex items-center justify-between border-t px-2 py-1 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {`${bot.sendingMessageInfo?.queueLength ?? "0"} mensage${bot.sendingMessageInfo?.queueLength === 1 ? "m" : "ns"} na fila`}
          </div>
          <button
            className="rounded-full border-2 border-yellow-400 bg-white/40 px-3 py-0.5 text-sm text-yellow-700 backdrop-blur transition hover:bg-yellow-50 dark:border-yellow-400 dark:bg-gray-800/60 dark:text-yellow-300 dark:hover:bg-yellow-900/40 xl:py-0"
            onClick={() => onShowMessages(bot)}
          >
            Mensagens
          </button>
        </div>
      }

      <div className="flex flex-col gap-1 border-t px-2 py-1 dark:border-gray-700 xl:py-0">
        {bot.sendingMessageInfo?.currentGroup &&
        bot.sendingMessageInfo.queueLength > 0 ? (
          <div className="truncate text-xs italic text-gray-700 dark:text-gray-300">
            {bot.sendingMessageInfo.content.slice(0, 240)}
          </div>
        ) : (
          <div className="text-xs italic text-gray-500 dark:text-gray-400">
            Nenhum envio no momento.
          </div>
        )}
        <div className="mb-1 flex items-center gap-2 rounded bg-blue-50 p-1 dark:bg-slate-700 xl:mb-0 xl:p-0.5">
          <span className="truncate text-xs text-blue-600 dark:text-blue-300">
            {bot.sendingMessageInfo?.currentGroup &&
            bot.sendingMessageInfo.queueLength > 0
              ? bot.sendingMessageInfo.currentGroup
              : "\u00A0"}
          </span>
          <div className="h-2 flex-1 rounded bg-gray-200 dark:bg-gray-800 xl:h-1.5">
            <div
              className="h-2 rounded bg-blue-500 transition-all dark:bg-blue-400"
              style={{
                width: `${
                  bot.sendingMessageInfo?.currentGroup &&
                  bot.sendingMessageInfo.queueLength > 0
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          ((bot.sendingMessageInfo.currentGroupIndex + 1) /
                            (bot.sendingMessageInfo.totalGroups ?? 1)) *
                            100
                        )
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
            {bot.sendingMessageInfo?.currentGroup &&
            bot.sendingMessageInfo.queueLength > 0 ? (
              <>
                {(bot.sendingMessageInfo.currentGroupIndex ?? 0) + 1} /{" "}
                {bot.sendingMessageInfo?.totalGroups ?? 0}
              </>
            ) : (
              <span className="italic text-gray-500 dark:text-gray-400">
                {"\u00A0"}
              </span>
            )}
          </span>
        </div>
      </div>

      {qrCode && (
        <div className="flex flex-col items-center gap-2 p-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            QR Code para login:
          </span>
          <QRCodeCanvas value={qrCode} size={320} />
        </div>
      )}
    </div>
  );
};

export default BotCard;
