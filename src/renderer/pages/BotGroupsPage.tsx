import React, { useEffect, useState } from "react";
import { Bot } from "../../models/bot-model";
import { BotGroup } from "src/models/bot-group";

interface BotGroupsPageProps {
  bot: Bot;
  onBack: () => void;
}

const BotGroupsPage: React.FC<BotGroupsPageProps> = ({ bot, onBack }) => {
  const [groups, setGroups] = useState<BotGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allSelected = groups.length > 0 && groups.every((g) => g.Broadcast);

  useEffect(() => {
    setLoading(true);
    window.appApi
      .getBotGroupsByBot(bot.Id)
      .then((result) => {
        setGroups(result);
      })
      .finally(() => setLoading(false));
  }, [bot.Id]);

  const toggleSelectAll = () => {
    setGroups((prevGroups) =>
      prevGroups.map((g) => ({ ...g, Broadcast: !allSelected }))
    );
  };

  const toggleSelect = (id: number) => {
    setGroups((prevGroups) =>
      prevGroups.map((g) =>
        g.GroupId === id ? { ...g, Broadcast: !g.Broadcast } : g
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.appApi.updateBotGroupsBroadcast(bot.Id, groups);
      onBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6 bg-white p-0 dark:bg-gray-900">
      <div className="">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            Grupos: {bot.Campaign || bot.WaNumber}
          </h2>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-gray-500 dark:text-gray-300">
              Carregando...
            </span>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <span className="mb-2 text-4xl">🤖</span>
            <span className="text-lg text-gray-600 dark:text-gray-300">
              Nenhum grupo associado a este bot.
            </span>
          </div>
        ) : (
          <ul className="grid max-h-[80vh] grid-cols-3 gap-2 overflow-y-auto rounded bg-white p-2 dark:bg-gray-800">
            {groups.map((group) => (
              <li
                key={group.GroupId}
                className="flex w-full cursor-pointer items-center gap-2 rounded bg-sky-50 p-2 shadow hover:bg-sky-100 dark:hover:bg-emerald-900/30"
                onClick={() => toggleSelect(group.GroupId)}
              >
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-emerald-600"
                  checked={!!group.Broadcast}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(group.GroupId)}
                />
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {group.Name}
                </span>
                {group.Members !== undefined && (
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {group.Members} membros
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-between space-x-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="form-checkbox h-4 w-4 text-emerald-600"
            checked={allSelected}
            onChange={toggleSelectAll}
          />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Selecionar todos
          </span>
        </label>
        <div className="flex gap-2">
          <button
            className="rounded-full bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            onClick={onBack}
          >
            Voltar
          </button>
          <button
            className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotGroupsPage;
