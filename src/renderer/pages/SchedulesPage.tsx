import React, { useEffect, useMemo, useState } from "react";

type ScheduleLite = {
  Id: number;
  Description: string;
  Created: string;
  LastRun: string;
  BotIds: number[];
  HasOnce: boolean;
  HasDaily: boolean;
  HasWeekly: boolean;
  HasMonthly: boolean;
  Once: {
    Year: number;
    Month: number;
    Day: number;
    Hour: number;
    Minute: number;
  } | null;
  Daily: { Hour: number; Minute: number } | null;
  Weekly: { Days: number[]; Hour: number; Minute: number } | null;
  Monthly: { Dates: number[]; Hour: number; Minute: number } | null;
};

interface Props {
  onOpen: (id: number) => void;
  onAddNew: () => void;
  bots: { Id: number; Campaign: string | null }[];
  activeBotIds?: number[];
  filterType: "all" | "once" | "daily" | "weekly" | "monthly";
  setFilterType: (t: "all" | "once" | "daily" | "weekly" | "monthly") => void;
  onlyToday: boolean;
  setOnlyToday: (v: boolean) => void;
  sortBy: "created" | "name" | "next";
  setSortBy: (v: "created" | "name" | "next") => void;
  selectedBotId: number | null;
  setSelectedBotId: (v: number | null) => void;
  weeklyDayFilter?: number | null;
  setWeeklyDayFilter?: (v: number | null) => void;
}

const groupTitle: Record<string, string> = {
  once: "Único",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

const weekdayLabels = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

function toTimeString(h?: number | null, m?: number | null) {
  const hh = String((h ?? 0) as number).padStart(2, "0");
  const mm = String((m ?? 0) as number).padStart(2, "0");
  return `${hh}:${mm}`;
}

function joinWithCommasAndAnd(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function buildDetailText(s: ScheduleLite): [string, string] {
  // Prefer full objects when available
  if (s.Once) {
    const date = new Date(
      s.Once.Year,
      s.Once.Month - 1,
      s.Once.Day,
      s.Once.Hour ?? 0,
      s.Once.Minute ?? 0,
      0,
      0
    );
    const left = `Execução única em ${date.toLocaleDateString()}`;
    const right = date.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    return [left, right];
  }
  if (s.Daily) {
    return ["Diário", toTimeString(s.Daily.Hour, s.Daily.Minute)];
  }
  if (s.Weekly) {
    const names = (s.Weekly.Days || [])
      .slice()
      .sort((a, b) => a - b)
      .map((d) => weekdayLabels[d] ?? String(d));
    return [
      joinWithCommasAndAnd(names),
      toTimeString(s.Weekly.Hour, s.Weekly.Minute),
    ];
  }
  if (s.Monthly) {
    const days = (s.Monthly.Dates || [])
      .slice()
      .sort((a, b) => a - b)
      .map((n) => String(n));
    const prefix = days.length > 1 ? "Dias" : "Dia";
    return [
      `${prefix} ${joinWithCommasAndAnd(days)}`,
      toTimeString(s.Monthly.Hour, s.Monthly.Minute),
    ];
  }
  // Fallbacks when objects are missing
  if (s.HasDaily) return ["Diário", ""];
  if (s.HasWeekly) return ["Semanal", ""];
  if (s.HasMonthly) return ["Mensal", ""];
  if (s.HasOnce) return ["Execução única", ""];
  console.warn("Schedule has no valid timing", s);
  return ["", ""];
}

function isScheduledToday(s: ScheduleLite, today: Date): boolean {
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-12
  const d = today.getDate();
  const dow = today.getDay(); // 0-6
  if (s.Once) {
    if (s.Once.Year === y && s.Once.Month === m && s.Once.Day === d)
      return true;
  }
  if (s.HasDaily || s.Daily) return true; // daily always displays
  if (s.Weekly && Array.isArray(s.Weekly.Days)) {
    if (s.Weekly.Days.includes(dow)) return true;
  }
  if (s.Monthly && Array.isArray(s.Monthly.Dates)) {
    if (s.Monthly.Dates.includes(d)) return true;
  }
  return false;
}

function nextRunDate(s: ScheduleLite, now: Date): Date | null {
  if (s.Once) {
    const dt = new Date(
      s.Once.Year,
      s.Once.Month - 1,
      s.Once.Day,
      s.Once.Hour ?? 0,
      s.Once.Minute ?? 0,
      0,
      0
    );
    return dt > now ? dt : null;
  }
  if (s.Daily) {
    const t = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      s.Daily.Hour ?? 0,
      s.Daily.Minute ?? 0,
      0,
      0
    );
    if (t > now) return t;
    const tomorrow = new Date(t);
    tomorrow.setDate(t.getDate() + 1);
    return tomorrow;
  }
  if (s.Weekly && Array.isArray(s.Weekly.Days) && s.Weekly.Days.length > 0) {
    const days = [...s.Weekly.Days].sort((a, b) => a - b);
    for (let i = 0; i < 14; i++) {
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        s.Weekly.Hour ?? 0,
        s.Weekly.Minute ?? 0,
        0,
        0
      );
      candidate.setDate(candidate.getDate() + i);
      if (days.includes(candidate.getDay()) && candidate > now) {
        return candidate;
      }
    }
    return null;
  }
  if (
    s.Monthly &&
    Array.isArray(s.Monthly.Dates) &&
    s.Monthly.Dates.length > 0
  ) {
    const dates = [...s.Monthly.Dates].sort((a, b) => a - b);
    for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
      const base = new Date(
        now.getFullYear(),
        now.getMonth() + monthOffset,
        1,
        s.Monthly.Hour ?? 0,
        s.Monthly.Minute ?? 0,
        0,
        0
      );
      const lastDay = new Date(
        base.getFullYear(),
        base.getMonth() + 1,
        0
      ).getDate();
      for (const day of dates) {
        const candidate = new Date(
          base.getFullYear(),
          base.getMonth(),
          Math.min(day, lastDay),
          s.Monthly.Hour ?? 0,
          s.Monthly.Minute ?? 0,
          0,
          0
        );
        if (candidate > now) return candidate;
      }
    }
    return null;
  }
  return null;
}

function onceDate(s: ScheduleLite): Date | null {
  if (!s.Once) return null;
  return new Date(
    s.Once.Year,
    s.Once.Month - 1,
    s.Once.Day,
    s.Once.Hour ?? 0,
    s.Once.Minute ?? 0,
    0,
    0
  );
}

const SchedulesPage: React.FC<Props> = ({
  onOpen,
  onAddNew,
  bots,
  activeBotIds = [],
  filterType,
  setFilterType,
  onlyToday,
  setOnlyToday,
  sortBy,
  setSortBy,
  selectedBotId,
  setSelectedBotId,
  weeklyDayFilter,
  setWeeklyDayFilter,
}) => {
  const [all, setAll] = useState<ScheduleLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filtered = useMemo(() => {
    const today = new Date();
    return all.filter((s) => {
      const matchesType =
        filterType === "all" ||
        (filterType === "once" && s.HasOnce) ||
        (filterType === "daily" && s.HasDaily) ||
        (filterType === "weekly" && s.HasWeekly) ||
        (filterType === "monthly" && s.HasMonthly);
      if (!matchesType) return false;
      if (selectedBotId != null && selectedBotId !== -1) {
        if (!Array.isArray(s.BotIds) || !s.BotIds.includes(selectedBotId)) {
          return false;
        }
      }
      if (filterType === "weekly" && weeklyDayFilter != null) {
        const days = s.Weekly?.Days || [];
        if (!Array.isArray(days) || !days.includes(weeklyDayFilter))
          return false;
      }
      // Filter by name (description), case-insensitive, updated on each keystroke
      const term = searchTerm.trim().toLowerCase();
      if (term.length > 0) {
        const name = (s.Description || "").toLowerCase();
        if (!name.includes(term)) return false;
      }
      if (!onlyToday) return true;
      return isScheduledToday(s, today);
    });
  }, [all, filterType, onlyToday, selectedBotId, searchTerm, weeklyDayFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, ScheduleLite[]> = {
      once: [],
      daily: [],
      weekly: [],
      monthly: [],
    };
    for (const s of filtered) {
      if (s.Once || s.HasOnce) groups.once.push(s);
      else if (s.Daily || s.HasDaily) groups.daily.push(s);
      else if (s.Weekly || s.HasWeekly) groups.weekly.push(s);
      else if (s.Monthly || s.HasMonthly) groups.monthly.push(s);
    }
    const now = new Date();
    const sorter = (a: ScheduleLite, b: ScheduleLite) => {
      if (sortBy === "name") {
        const an = (a.Description || "").toString();
        const bn = (b.Description || "").toString();
        return an.localeCompare(bn, undefined, { sensitivity: "base" });
      }
      if (sortBy === "next") {
        const na = nextRunDate(a, now);
        const nb = nextRunDate(b, now);
        if (na == null && nb == null) {
          // Both have no next run: sort past "once" schedules by their original date ascending
          const da = onceDate(a);
          const db = onceDate(b);
          if (da && db) return da.getTime() - db.getTime();
          // fallback: by Created ascending
          if (!da && !db)
            return a.Created < b.Created ? -1 : a.Created > b.Created ? 1 : 0;
          return da ? -1 : 1;
        }
        if (na == null) return 1;
        if (nb == null) return -1;
        return na.getTime() - nb.getTime();
      }
      // created (default):
      return a.Created < b.Created ? 1 : a.Created > b.Created ? -1 : 0;
    };
    Object.keys(groups).forEach((k) => groups[k].sort(sorter));
    return groups;
  }, [filtered, sortBy]);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await window.appApi.getAllSchedulesLite();
      // Enrich data in case the API returns without the Once/Daily/Weekly/Monthly objects
      const enriched = await Promise.all(
        rows.map(async (r: any) => {
          const hasNewFields =
            Object.prototype.hasOwnProperty.call(r, "Once") ||
            Object.prototype.hasOwnProperty.call(r, "Daily") ||
            Object.prototype.hasOwnProperty.call(r, "Weekly") ||
            Object.prototype.hasOwnProperty.call(r, "Monthly");
          if (hasNewFields) return r as ScheduleLite;
          try {
            const full = await window.appApi.getScheduleById(r.Id);
            return {
              ...r,
              Once: full?.Once || null,
              Daily: full?.Daily || null,
              Weekly: full?.Weekly || null,
              Monthly: full?.Monthly || null,
            } as ScheduleLite;
          } catch {
            return {
              ...r,
              Once: null,
              Daily: null,
              Weekly: null,
              Monthly: null,
            } as ScheduleLite;
          }
        })
      );
      setAll(enriched);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const renderGroup = (key: keyof typeof grouped) => {
    const items = grouped[key];
    if (!items || items.length === 0) return null;
    const now = new Date();
    return (
      <div className="mb-6" key={key}>
        <h3 className="mb-2 border-b pb-1 text-lg font-bold text-emerald-700 dark:text-emerald-400">
          {filterType === "all" && groupTitle[key]}
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((s) => (
            <div
              key={s.Id}
              className={`cursor-pointer rounded border border-gray-200 p-2 shadow ring-1 ring-violet-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:hover:bg-gray-800 ${
                key === "once" &&
                (() => {
                  const dt = onceDate(s);
                  return dt != null && dt < now;
                })()
                  ? "bg-gray-50 opacity-60"
                  : "bg-white"
              }`}
              onClick={() => onOpen(s.Id)}
            >
              <div className="mb-1 rounded text-base font-bold text-violet-800 dark:text-violet-400">
                {s.Description || ""}
              </div>
              <div className="mb-1 flex items-center justify-between border-b text-sm font-semibold text-green-700 dark:text-green-200">
                {(() => {
                  const [left, right] = buildDetailText(s);
                  return (
                    <>
                      <span>{left}</span>
                      <span className="ml-2 tabular-nums">{right}</span>
                    </>
                  );
                })()}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>Última execução</span>
                <span>
                  {s.LastRun
                    ? new Date(s.LastRun).toLocaleString(undefined, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : "-"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {(s.BotIds || [])
                  .map(
                    (id) => bots.find((b) => b.Id === id)?.Campaign || `#${id}`
                  )
                  .filter(Boolean)
                  .map((name, idx) => (
                    <span
                      key={`${s.Id}-bot-${idx}`}
                      className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                      {name as string}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
          Agendamentos
        </h2>
        <button
          className="rounded-full border border-emerald-500 bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-700 dark:bg-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-800"
          onClick={onAddNew}
        >
          Novo
        </button>
      </div>
      <div className="sticky top-0 z-10 mb-3 rounded border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="flex w-full items-center gap-4">
          <select
            className="rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            value={filterType}
            onChange={(e) =>
              setFilterType(
                e.target.value as
                  | "all"
                  | "once"
                  | "daily"
                  | "weekly"
                  | "monthly"
              )
            }
          >
            <option value="all">Todos</option>
            <option value="once">Único</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          {filterType === "weekly" ? (
            <select
              className="w-40 rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              value={weeklyDayFilter ?? -1}
              onChange={(e) => {
                const v = Number(e.target.value);
                setWeeklyDayFilter &&
                  setWeeklyDayFilter(Number.isNaN(v) || v === -1 ? null : v);
              }}
              title="Filtrar por dia da semana"
            >
              <option value={-1}>Dias</option>
              {weekdayLabels.map((label, idx) => (
                <option key={`wd-${idx}`} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <label className="flex w-40 items-center justify-center gap-2 border-x text-sm dark:text-gray-100">
              <input
                className=""
                type="checkbox"
                checked={onlyToday}
                onChange={(e) => setOnlyToday(e.target.checked)}
              />
              <span className="">Hoje</span>
            </label>
          )}

          <select
            className="rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            value={selectedBotId ?? -1}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSelectedBotId(Number.isNaN(v) || v === -1 ? null : v);
            }}
          >
            <option value={-1}>Todos bots</option>
            {bots
              .filter((b) =>
                Array.isArray(activeBotIds) && activeBotIds.length > 0
                  ? activeBotIds.includes(b.Id)
                  : true
              )
              .map((b) => (
                <option key={b.Id} value={b.Id}>
                  {b.Campaign || `#${b.Id}`}
                </option>
              ))}
          </select>
          <select
            className="rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "created" | "name" | "next")
            }
            title="Ordenar por"
          >
            <option value="created">Cadastro</option>
            <option value="name">Nome</option>
            <option value="next">Execução</option>
          </select>
          <input
            type="text"
            placeholder="Nome do agendamento"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex w-full rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div>
          {renderGroup("once")}
          {renderGroup("daily")}
          {renderGroup("weekly")}
          {renderGroup("monthly")}
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;
