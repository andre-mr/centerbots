import React, { useState } from "react";
import { Message } from "../../models/message-model";
import { FiChevronDown, FiChevronUp, FiTrash2, FiCopy } from "react-icons/fi";

interface BotMessageProps {
  msg: Message;
  idx?: number;
  isQueueItem?: boolean;
  onUp?: () => void;
  onDown?: () => void;
  onDelete?: () => void;
  isFirst?: boolean;
}

const BotMessage: React.FC<BotMessageProps> = ({
  msg,
  idx,
  isQueueItem,
  onUp,
  onDown,
  onDelete,
  isFirst,
}) => {
  const [expanded, setExpanded] = useState(!!isFirst);

  const dateStr = msg.Timestamp
    ? new Date(msg.Timestamp).toLocaleString()
    : "-";
  const sender =
    msg.SenderJid && msg.SenderJid.includes("@")
      ? msg.SenderJid.split("@")[0]
      : msg.SenderJid || "-";
  const maxChars = 120;
  const maxLines = 3;

  let contentLine1 = "";
  if (msg.Content) {
    if (expanded) {
      contentLine1 = msg.Content;
    } else {
      contentLine1 = msg.Content.slice(0, maxChars)
        .replace(/\n{2,}/g, "\n")
        .split("\n")
        .slice(0, maxLines)
        .join("\n");
    }
  }
  const urlMatch = msg.Content
    ? msg.Content.match(/(https?:\/\/[^\s]+)/i)
    : null;
  const firstUrl = urlMatch ? urlMatch[0] : null;

  return (
    <div
      key={msg.Id || idx}
      className={`mb-2 flex flex-col gap-1 rounded border-b border-gray-200 p-1 text-sm shadow last:border-0 dark:border-gray-700 ${isFirst ? "bg-emerald-50 ring-2 ring-emerald-400 ring-opacity-60 dark:bg-emerald-950" : ""} `}
    >
      <div className="flex flex-row items-center gap-4 text-gray-800 dark:text-gray-200">
        <span className="whitespace-nowrap font-bold">{dateStr}</span>
        <span className="whitespace-nowrap font-semibold text-green-700 dark:text-green-400">
          {sender}
        </span>
        {isQueueItem && (
          <span className="ml-auto flex gap-1 text-base">
            <button
              title="Subir"
              onClick={onUp}
              className="rounded p-1 text-emerald-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <FiChevronUp className="h-5 w-5" />
            </button>
            <button
              title="Descer"
              onClick={onDown}
              className="rounded p-1 text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <FiChevronDown className="h-5 w-5" />
            </button>
            <button
              title="Remover"
              onClick={onDelete}
              className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900"
            >
              <FiTrash2 className="h-5 w-5" />
            </button>
          </span>
        )}
      </div>
      <div className="relative ml-1 mt-1 flex flex-col">
        <span
          className={
            expanded
              ? "mr-16 break-words text-gray-800 dark:text-gray-100"
              : "break-words text-gray-800 dark:text-gray-100"
          }
          style={{ whiteSpace: "pre-line" }}
        >
          {contentLine1}
          {!expanded && msg.Content && msg.Content.split("\n").length > maxLines
            ? "..."
            : ""}
        </span>
        {!expanded && firstUrl && (
          <a
            href={firstUrl}
            target="_blank"
            className="mr-16 w-fit break-all text-blue-700 underline dark:text-blue-400"
          >
            {firstUrl}
          </a>
        )}
        <div className="absolute bottom-0 right-0 flex space-x-1">
          <button
            className="rounded px-1 text-base text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Copiar mensagem"
            onClick={() => {
              if (msg.Content) {
                navigator.clipboard.writeText(msg.Content);
              }
            }}
          >
            <FiCopy className="h-5 w-5" />
          </button>
          <button
            className="rounded px-1 text-base text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title={expanded ? "Recolher" : "Expandir"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <FiChevronUp className="h-5 w-5" />
            ) : (
              <FiChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotMessage;
