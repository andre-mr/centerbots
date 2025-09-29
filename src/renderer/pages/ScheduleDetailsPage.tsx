import React, { useEffect, useMemo, useRef, useState } from "react";
import { Schedule } from "../../models/schedule-model";
import { Bot } from "../../models/bot-model";

interface Props {
  schedule: Schedule;
  isNew?: boolean;
  onBack: () => void;
}

type ScheduleType = "once" | "daily" | "weekly" | "monthly";

type MediaItem = {
  id: string;
  type: "image" | "video";
  source: "new" | "existing";
  data: string; // base64 for new items, relative path for existing
  preview?: string; // data URL for preview
  extension?: string; // for new media (image/video)
  mime?: string; // mime type for new media
  name?: string; // display name
};

const weekdayKeys = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const weekdayLabels: Record<(typeof weekdayKeys)[number], string> = {
  Sunday: "Domingo",
  Monday: "Segunda",
  Tuesday: "Terça",
  Wednesday: "Quarta",
  Thursday: "Quinta",
  Friday: "Sexta",
  Saturday: "Sábado",
};

function toTimeString(h?: number | null, m?: number | null) {
  const hh = String((h ?? 0) as number).padStart(2, "0");
  const mm = String((m ?? 0) as number).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseTimeString(t: string): { Hour: number; Minute: number } {
  const [h, m] = t.split(":");
  return { Hour: Number(h) || 0, Minute: Number(m) || 0 };
}

const ScheduleDetailsPage: React.FC<Props> = ({ schedule, isNew, onBack }) => {
  const [form, setForm] = useState<Schedule>(schedule);
  const [bots, setBots] = useState<Bot[]>([]);
  const [contentIdx, setContentIdx] = useState(0);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [removedMedia, setRemovedMedia] = useState<Set<string>>(new Set());
  // Keep track of current media preview for lazy loading
  const [currentMediaPreview, setCurrentMediaPreview] = useState<string | null>(
    null
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDraftNew, setIsDraftNew] = useState<boolean>(!!isNew);

  useEffect(() => {
    // Initialize form and media items
    const nextForm = {
      ...schedule,
      Contents:
        Array.isArray(schedule.Contents) && schedule.Contents.length > 0
          ? schedule.Contents
          : [""],
    } as Schedule;
    setForm(nextForm);

    // Initialize unified media items list
    const initializeMediaItems = () => {
      const items: MediaItem[] = [];

      // Add existing medias from schedule
      if (Array.isArray(nextForm.Medias)) {
        nextForm.Medias.forEach((rel, index) => {
          const isVideo =
            rel.startsWith("video/") || /\.(mp4|webm)$/i.test(rel);
          const name = rel.split("/").pop() || rel;
          items.push({
            id: `existing-${index}`,
            type: isVideo ? "video" : "image",
            source: "existing",
            data: rel,
            name,
          });
        });
      }

      // If no existing media, add one empty slot for new media
      if (items.length === 0) {
        items.push({
          id: "new-0",
          type: "image",
          source: "new",
          data: "",
        });
      }

      setMediaItems(items);
    };

    initializeMediaItems();
    setRemovedMedia(new Set());
    setContentIdx(0);
    setCurrentMediaIndex(0);
    setCurrentMediaPreview(null);
    setIsDraftNew(!!isNew);
  }, [schedule, isNew]);

  useEffect(() => {
    const loadBots = async () => setBots(await window.appApi.getAllBots());
    loadBots();
  }, []);

  // Load preview for current media item
  useEffect(() => {
    const loadCurrentMediaPreview = async () => {
      if (mediaItems.length === 0 || currentMediaIndex >= mediaItems.length) {
        setCurrentMediaPreview(null);
        return;
      }

      const currentItem = mediaItems[currentMediaIndex];

      if (currentItem.source === "new") {
        // For new items, preview prefers stored data URL, fallback to mime-based data URL
        if (currentItem.preview) {
          setCurrentMediaPreview(currentItem.preview);
        } else if (currentItem.data && currentItem.data.trim()) {
          let mime = currentItem.mime;
          if (!mime) {
            if (currentItem.type === "video") {
              mime =
                currentItem.extension === "webm" ? "video/webm" : "video/mp4";
            } else {
              if (
                currentItem.extension &&
                currentItem.extension.toLowerCase() === "png"
              )
                mime = "image/png";
              else if (
                currentItem.extension &&
                currentItem.extension.toLowerCase() === "webp"
              )
                mime = "image/webp";
              else if (
                currentItem.extension &&
                currentItem.extension.toLowerCase() === "gif"
              )
                mime = "image/gif";
              else mime = "image/jpeg";
            }
          }
          setCurrentMediaPreview(`data:${mime};base64,${currentItem.data}`);
        } else {
          setCurrentMediaPreview(null);
        }
      } else {
        // For existing items, load from disk
        if (!removedMedia.has(currentItem.data)) {
          try {
            const dataUrl = await window.appApi.getMediaDataUrl(
              currentItem.data
            );
            setCurrentMediaPreview(dataUrl || null);
          } catch {
            setCurrentMediaPreview(null);
          }
        } else {
          setCurrentMediaPreview(null);
        }
      }
    };

    loadCurrentMediaPreview();
  }, [mediaItems, currentMediaIndex, removedMedia]);

  const type: ScheduleType = useMemo(() => {
    if (form.Once) return "once";
    if (form.Daily) return "daily";
    if (form.Weekly) return "weekly";
    return "monthly";
  }, [form.Once, form.Daily, form.Weekly, form.Monthly]);

  const changeType = (t: ScheduleType) => {
    setForm((prev) => ({
      ...prev,
      Once:
        t === "once"
          ? prev.Once || {
              Year: new Date().getFullYear(),
              Month: new Date().getMonth() + 1,
              Day: new Date().getDate(),
              Hour: 8,
              Minute: 0,
            }
          : null,
      Daily: t === "daily" ? prev.Daily || { Hour: 8, Minute: 0 } : null,
      Weekly:
        t === "weekly"
          ? (prev.Weekly as any) || { Days: [1], Hour: 8, Minute: 0 }
          : null,
      Monthly:
        t === "monthly"
          ? prev.Monthly || { Dates: [1], Hour: 8, Minute: 0 }
          : null,
    }));
  };

  const toggleWeeklyDay = (dayIndex: number) => {
    setForm((prev) => {
      const days = new Set<number>(
        ((prev.Weekly as any)?.Days ?? []) as number[]
      );
      if (days.has(dayIndex)) days.delete(dayIndex);
      else days.add(dayIndex);
      return {
        ...prev,
        Weekly: {
          Days: Array.from(days).sort((a, b) => a - b),
          Hour: (prev.Weekly as any)?.Hour ?? 9,
          Minute: (prev.Weekly as any)?.Minute ?? 0,
        } as any,
      };
    });
  };

  const renderWeeklyDayButton = (dayIndex: number) => {
    const weekdayKey = weekdayKeys[dayIndex];
    const selected = (form.Weekly as any).Days?.includes(dayIndex);
    return (
      <button
        type="button"
        key={weekdayKey}
        className={`rounded border px-2 py-2 text-sm ${selected ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-300"}`}
        onClick={() => toggleWeeklyDay(dayIndex)}
      >
        {weekdayLabels[weekdayKey]}
      </button>
    );
  };

  const handleSave = async () => {
    if (!isValidForm()) return;
    setSaving(true);
    setError(null);
    try {
      // Prepare payload: sanitize empty tails
      const contents = (form.Contents || []).map((c) => (c ?? "").toString());
      // remove trailing empty contents
      while (
        contents.length > 1 &&
        (contents[contents.length - 1] || "").trim() === ""
      ) {
        contents.pop();
      }

      // Extract images and videos from unified media items
      const newImages: Array<string | { Base64: string; Ext: string }> = [];
      const newVideos: { Base64: string; Ext: string }[] = [];

      mediaItems.forEach((item) => {
        if (item.source === "new" && item.data && item.data.trim()) {
          if (item.type === "image") {
            const ext = (item.extension || "jpg").toLowerCase();
            newImages.push({ Base64: item.data, Ext: ext });
          } else if (item.type === "video" && item.extension) {
            newVideos.push({
              Base64: item.data,
              Ext: item.extension,
            });
          }
        }
      });

      const payload: any = {
        ...form,
        Contents: contents,
        ImagesBase64: newImages,
        VideosBase64: newVideos,
        RemovedMediaRelPaths: Array.from(removedMedia),
      };
      if (isDraftNew) await window.appApi.createSchedule(payload);
      else await window.appApi.updateSchedule(payload);
      onBack();
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await window.appApi.deleteSchedule(form.Id);
      onBack();
    } catch (e: any) {
      setError(e?.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleClone = async () => {
    // Capture current medias (disk refs) before turning this into a new draft
    const originalMedias = Array.isArray(form.Medias) ? [...form.Medias] : [];

    // Prepare a new schedule draft (Id=0) with same fields, but without existing Medias
    const clonedSchedule: Schedule = {
      ...form,
      Id: 0,
      Contents: [...(form.Contents || [])],
      BotIds: [...(form.BotIds || [])],
      Once: form.Once ? { ...form.Once } : null,
      Daily: form.Daily ? { ...form.Daily } : null,
      Weekly: form.Weekly
        ? { ...form.Weekly, Days: [...form.Weekly.Days] }
        : null,
      Monthly: form.Monthly
        ? { ...form.Monthly, Dates: [...form.Monthly.Dates] }
        : null,
      Created: new Date().toISOString(),
      LastRun: "",
      Medias: [], // behave exactly like a brand new schedule (no existing medias)
    } as Schedule;
    setForm(clonedSchedule);

    // Convert existing medias to in-memory "new" items (base64), like freshly added attachments
    const newItems: MediaItem[] = [];
    for (let i = 0; i < originalMedias.length; i++) {
      const rel = originalMedias[i];
      try {
        const dataUrl = await window.appApi.getMediaDataUrl(rel);
        if (!dataUrl) continue;
        const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/i);
        if (!m) continue;
        const mime = (m[1] || "").toLowerCase();
        const base64 = m[2] || "";
        const isVideo =
          rel.startsWith("video/") ||
          mime.startsWith("video/") ||
          /\.(mp4|webm)$/i.test(rel);
        let extension = (() => {
          if (mime.includes("mp4")) return "mp4";
          if (mime.includes("webm")) return "webm";
          if (mime.includes("png")) return "png";
          if (mime.includes("webp")) return "webp";
          if (mime.includes("gif")) return "gif";
          const nameExt = rel.split(".").pop()?.toLowerCase();
          if (nameExt) return nameExt;
          return isVideo ? "mp4" : "jpg";
        })();
        const name = rel.split("/").pop() || rel;
        newItems.push({
          id: `new-${Date.now()}-${i}`,
          type: isVideo ? "video" : "image",
          source: "new",
          data: base64,
          extension,
          mime,
          preview: dataUrl,
          name,
        });
      } catch {
        // ignore individual failures
      }
    }

    // If no medias existed, keep a single empty slot; else set converted items
    if (newItems.length === 0) {
      setMediaItems([
        {
          id: "new-0",
          type: "image",
          source: "new",
          data: "",
        },
      ]);
    } else {
      setMediaItems(newItems);
    }

    setCurrentMediaIndex(0);
    setCurrentMediaPreview(null);
    setRemovedMedia(new Set());
    setIsDraftNew(true);
    setError(null);
    setShowDeleteModal(false);
  };

  const handleFile = (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const b64 = resultStr.split(",")[1] || null;
      if (b64) {
        setMediaItems((prev) => {
          const arr = [...prev];
          const currentItem = arr[currentMediaIndex];
          const extFromMime = (() => {
            const t = (file.type || "").toLowerCase();
            if (t.includes("png")) return "png";
            if (t.includes("webp")) return "webp";
            if (t.includes("gif")) return "gif";
            if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
            if (t.includes("mp4")) return "mp4";
            if (t.includes("webm")) return "webm";
            const nameExt = (file.name || "").split(".").pop()?.toLowerCase();
            if (nameExt) return nameExt;
            return isVideo ? "mp4" : "jpg";
          })();

          if (
            currentItem &&
            currentItem.source === "new" &&
            !currentItem.data.trim()
          ) {
            // Update current empty slot
            arr[currentMediaIndex] = {
              ...currentItem,
              type: isVideo ? "video" : "image",
              data: b64,
              extension: extFromMime,
              mime:
                file.type ||
                (isVideo
                  ? extFromMime === "webm"
                    ? "video/webm"
                    : "video/mp4"
                  : extFromMime === "png"
                    ? "image/png"
                    : extFromMime === "webp"
                      ? "image/webp"
                      : extFromMime === "gif"
                        ? "image/gif"
                        : "image/jpeg"),
              preview: resultStr,
            };
          } else {
            // Add new slot
            const newId = `new-${Date.now()}`;
            arr.push({
              id: newId,
              type: isVideo ? "video" : "image",
              source: "new",
              data: b64,
              extension: extFromMime,
              mime:
                file.type ||
                (isVideo
                  ? extFromMime === "webm"
                    ? "video/webm"
                    : "video/mp4"
                  : extFromMime === "png"
                    ? "image/png"
                    : extFromMime === "webp"
                      ? "image/webp"
                      : extFromMime === "gif"
                        ? "image/gif"
                        : "image/jpeg"),
              preview: resultStr,
            });
            setCurrentMediaIndex(arr.length - 1);
          }
          return arr;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    }
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      try {
        mediaItems.forEach((item) => {
          if (item.source === "new" && item.preview) {
            URL.revokeObjectURL(item.preview);
          }
        });
      } catch {}
    };
  }, []);

  const isValidForm = () => {
    const hasContent = (form.Contents || []).some(
      (c) => (c || "").trim() !== ""
    );
    const hasNewMedia = mediaItems.some(
      (item) => item.source === "new" && item.data && item.data.trim()
    );
    const hasExistingMedia = Array.isArray(form.Medias)
      ? form.Medias.some((rel) => !removedMedia.has(rel))
      : false;
    return !!(
      form.Description &&
      form.Description.trim() !== "" &&
      (hasContent || hasNewMedia || hasExistingMedia)
    );
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {isDraftNew
              ? "Novo agendamento"
              : `Editar agendamento "${(form.Description || `#${form.Id}`).toString()}"`}
          </h2>
          <p className="text-sm italic text-gray-600 dark:text-gray-400">
            Última execução:{" "}
            <span className="ml-1">
              {schedule.LastRun
                ? new Date(schedule.LastRun).toLocaleString()
                : "N/D"}
            </span>
          </p>
        </div>
        {error && (
          <p className="text-center text-red-500 dark:text-red-400">
            Erro: {error}
          </p>
        )}
        <div className="grid max-h-[95vh] grid-cols-2 gap-6 overflow-y-auto">
          <div className="flex h-full flex-col gap-4">
            <div className="flex flex-col">
              <label className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">
                Nome do agendamento
              </label>
              <input
                type="text"
                className="rounded border border-gray-200 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                value={form.Description || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, Description: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">
                Bots responsáveis pelo envio
              </label>
              <div className="rounded border border-gray-200 px-2 py-1 dark:border-gray-800 dark:text-gray-100">
                <div className="grid grid-cols-2 gap-1">
                  {bots.map((b) => {
                    const checked = form.BotIds.includes(b.Id);
                    return (
                      <label key={b.Id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm((prev) => {
                              const set = new Set(prev.BotIds);
                              if (e.target.checked) set.add(b.Id);
                              else set.delete(b.Id);
                              return { ...prev, BotIds: Array.from(set) };
                            })
                          }
                        />
                        {b.Campaign || b.WaNumber || `Bot #${b.Id}`}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">
                Tipo de agendamento
              </label>
              <div className="rounded border border-gray-200 px-2 py-1 dark:border-gray-800 dark:text-gray-100">
                <div className="flex gap-4">
                  {(
                    ["once", "daily", "weekly", "monthly"] as ScheduleType[]
                  ).map((t) => (
                    <label key={t} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={type === t}
                        onChange={() => changeType(t)}
                      />
                      {t === "once"
                        ? "Único"
                        : t === "daily"
                          ? "Diário"
                          : t === "weekly"
                            ? "Semanal"
                            : "Mensal"}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {type === "once" && form.Once && (
              <div className="flex flex-col">
                <label className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">
                  Data e horário
                </label>
                <div className="rounded border border-gray-200 px-2 py-1 dark:border-gray-800">
                  <div className="flex gap-2">
                    <input
                      className="pl-1 dark:bg-gray-800 dark:text-gray-100"
                      type="date"
                      value={`${String(form.Once.Year).padStart(4, "0")}-${String(form.Once.Month).padStart(2, "0")}-${String(form.Once.Day).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [y, m, d] = e.target.value.split("-");
                        setForm((prev) => ({
                          ...prev,
                          Once: {
                            ...(prev.Once || ({} as any)),
                            Year: Number(y),
                            Month: Number(m),
                            Day: Number(d),
                            Hour: prev.Once?.Hour ?? 9,
                            Minute: prev.Once?.Minute ?? 0,
                          },
                        }));
                      }}
                    />
                    <input
                      className="rounded pl-1 font-semibold text-blue-700 dark:bg-gray-800 dark:text-gray-100"
                      type="time"
                      value={toTimeString(form.Once.Hour, form.Once.Minute)}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          Once: {
                            ...(prev.Once || ({} as any)),
                            ...parseTimeString(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {type === "daily" && form.Daily && (
              <div className="flex flex-col">
                <label className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">
                  Horário
                </label>
                <div className="rounded border border-gray-200 px-2 py-1 dark:border-gray-800">
                  <input
                    className="rounded pl-1 font-semibold text-blue-700 dark:bg-gray-800 dark:text-gray-100"
                    type="time"
                    value={toTimeString(form.Daily.Hour, form.Daily.Minute)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        Daily: parseTimeString(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {type === "weekly" && form.Weekly && (
              <div className="flex flex-col">
                <label className="mb-2 block font-semibold text-gray-700 dark:text-gray-200">
                  Dias e horário
                </label>
                <div className="rounded border border-gray-200 px-3 pb-1 pt-3 dark:border-gray-800">
                  <div className="mb-2 flex flex-col gap-1">
                    <div className="grid grid-cols-5 gap-1 dark:text-gray-100">
                      {[1, 2, 3, 4, 5].map((day) => renderWeeklyDayButton(day))}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 dark:text-gray-100">
                      {[6, 0].map((day) => renderWeeklyDayButton(day))}
                    </div>
                  </div>
                  <input
                    className="rounded pl-1 font-semibold text-blue-700 dark:bg-gray-800 dark:text-gray-100"
                    type="time"
                    value={toTimeString(
                      (form.Weekly as any).Hour,
                      (form.Weekly as any).Minute
                    )}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        Weekly: {
                          Days: ((prev.Weekly as any)?.Days ?? []) as number[],
                          ...parseTimeString(e.target.value),
                        } as any,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {type === "monthly" && form.Monthly && (
              <div className="flex flex-col">
                <label className="mb-2 block font-semibold text-gray-700 dark:text-gray-200">
                  Dias e horário
                </label>
                <div className="rounded border border-gray-200 px-3 pb-1 pt-3 dark:border-gray-800">
                  <div className="mb-2 grid grid-cols-6 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                      const selected = form.Monthly!.Dates.includes(d);
                      return (
                        <button
                          type="button"
                          key={d}
                          className={`rounded border px-2 py-1 text-sm ${selected ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-300 dark:text-gray-100"}`}
                          onClick={() =>
                            setForm((prev) => {
                              const arr = new Set(prev.Monthly!.Dates);
                              if (arr.has(d)) arr.delete(d);
                              else arr.add(d);
                              return {
                                ...prev,
                                Monthly: {
                                  ...prev.Monthly!,
                                  Dates: Array.from(arr).sort((a, b) => a - b),
                                  Hour: prev.Monthly!.Hour,
                                  Minute: prev.Monthly!.Minute,
                                },
                              };
                            })
                          }
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="rounded pl-1 font-semibold text-blue-700 dark:bg-gray-800 dark:text-gray-100"
                    type="time"
                    value={toTimeString(form.Monthly.Hour, form.Monthly.Minute)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        Monthly: {
                          ...prev.Monthly!,
                          ...parseTimeString(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex h-full flex-col gap-4">
            <div className="flex flex-col">
              <div className="mb-0.5 flex items-center justify-between">
                <label className="font-semibold text-gray-700 dark:text-gray-200">
                  Textos
                </label>
                <div className="flex items-center gap-2 text-sm dark:text-gray-100">
                  <button
                    type="button"
                    className={`w-6 rounded border px-2 py-0.5 ${contentIdx === 0 ? "cursor-not-allowed opacity-40" : "bg-emerald-100 font-bold"}`}
                    onClick={() => setContentIdx((i) => Math.max(0, i - 1))}
                    disabled={contentIdx === 0}
                    title="Anterior"
                  >
                    ‹
                  </button>
                  <span className="tabular-nums dark:text-gray-100">
                    {Math.min(
                      contentIdx + 1,
                      Math.max(1, (form.Contents || []).length)
                    )}
                    /{Math.max(1, (form.Contents || []).length)}
                  </span>
                  <button
                    type="button"
                    className={`mr-5 w-6 rounded border px-2 py-0.5 dark:text-gray-100 ${contentIdx >= (form.Contents?.length || 1) - 1 ? "cursor-not-allowed opacity-40" : "bg-emerald-100 font-bold"}`}
                    onClick={() =>
                      setContentIdx((i) =>
                        Math.min((form.Contents?.length || 1) - 1, i + 1)
                      )
                    }
                    disabled={contentIdx >= (form.Contents?.length || 1) - 1}
                    title="Próximo"
                  >
                    ›
                  </button>
                  {/* Remove and Add controls */}
                  <button
                    type="button"
                    className={`mx-2 w-8 rounded bg-emerald-600 px-2 py-0.5 text-white ${
                      (form.Contents || []).length > 0 &&
                      (
                        (form.Contents || [""])[
                          (form.Contents || [""]).length - 1
                        ] || ""
                      ).trim() === ""
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                    onClick={() =>
                      setForm((prev) => {
                        const arr = [...(prev.Contents || [""])];
                        arr.push("");
                        setContentIdx(arr.length - 1);
                        return { ...prev, Contents: arr };
                      })
                    }
                    disabled={
                      (form.Contents || []).length > 0 &&
                      (
                        (form.Contents || [""])[
                          (form.Contents || [""]).length - 1
                        ] || ""
                      ).trim() === ""
                    }
                    title="Adicionar novo conteúdo"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={`w-8 rounded bg-red-500 px-2 py-0.5 text-white ${
                      (form.Contents || []).length <= 1
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                    onClick={() => {
                      if ((form.Contents || []).length <= 1) return;
                      setForm((prev) => {
                        const arr = [...(prev.Contents || [""])];
                        arr.splice(contentIdx, 1);
                        const nextIdx = Math.min(arr.length - 1, contentIdx);
                        setContentIdx(Math.max(0, nextIdx));
                        return {
                          ...prev,
                          Contents: arr.length > 0 ? arr : [""],
                        };
                      });
                    }}
                    disabled={(form.Contents || []).length <= 1}
                    title="Remover conteúdo"
                  >
                    -
                  </button>
                </div>
              </div>
              <textarea
                className="h-60 rounded border border-gray-200 p-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                value={(form.Contents || [""])[contentIdx] || ""}
                onChange={(e) =>
                  setForm((prev) => {
                    const arr = [...(prev.Contents || [""])];
                    arr[contentIdx] = e.target.value;
                    return { ...prev, Contents: arr } as Schedule;
                  })
                }
              />
            </div>
            <div className="mt-2 flex flex-col">
              <div className="mb-0.5 flex items-center justify-between">
                <div className="flex flex-col">
                  <label className="font-semibold text-gray-700 dark:text-gray-200">
                    Mídias
                  </label>
                </div>
                <div className="flex items-center gap-2 text-sm dark:text-gray-100">
                  <button
                    type="button"
                    className={`w-6 rounded border px-2 py-0.5 dark:text-gray-100 ${currentMediaIndex === 0 ? "cursor-not-allowed opacity-40" : "bg-emerald-100 font-bold"}`}
                    onClick={() =>
                      setCurrentMediaIndex((i) => Math.max(0, i - 1))
                    }
                    disabled={currentMediaIndex === 0}
                    title="Anterior"
                  >
                    ‹
                  </button>
                  <span className="tabular-nums">
                    {Math.min(
                      currentMediaIndex + 1,
                      Math.max(1, mediaItems.length)
                    )}
                    /{Math.max(1, mediaItems.length)}
                  </span>
                  <button
                    type="button"
                    className={`mr-5 w-6 rounded border px-2 py-0.5 dark:text-gray-100 ${
                      currentMediaIndex >= mediaItems.length - 1
                        ? "cursor-not-allowed opacity-40"
                        : "bg-emerald-100 font-bold"
                    }`}
                    onClick={() =>
                      setCurrentMediaIndex((i) =>
                        Math.min(mediaItems.length - 1, i + 1)
                      )
                    }
                    disabled={currentMediaIndex >= mediaItems.length - 1}
                    title="Próximo"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className={`mx-2 w-8 rounded bg-emerald-600 px-2 py-0.5 text-white ${
                      mediaItems.length > 0 &&
                      mediaItems[mediaItems.length - 1]?.source === "new" &&
                      !mediaItems[mediaItems.length - 1]?.data?.trim()
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                    onClick={() =>
                      setMediaItems((prev) => {
                        const arr = [...prev];
                        arr.push({
                          id: `new-${Date.now()}`,
                          type: "image",
                          source: "new",
                          data: "",
                        });
                        setCurrentMediaIndex(arr.length - 1);
                        return arr;
                      })
                    }
                    disabled={
                      mediaItems.length > 0 &&
                      mediaItems[mediaItems.length - 1]?.source === "new" &&
                      !mediaItems[mediaItems.length - 1]?.data?.trim()
                    }
                    title="Adicionar nova mídia"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={`w-8 rounded bg-red-500 px-2 py-0.5 text-white ${
                      mediaItems.length === 0 ||
                      (mediaItems.length === 1 && !mediaItems[0].data)
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                    onClick={() => {
                      const currentItem = mediaItems[currentMediaIndex];
                      if (
                        !currentItem ||
                        (mediaItems.length === 1 && !currentItem.data)
                      )
                        return;

                      if (currentItem?.source === "existing") {
                        // Mark existing media for removal
                        setRemovedMedia(
                          (prev) => new Set([...prev, currentItem.data])
                        );
                      }

                      setMediaItems((prev) => {
                        const arr = [...prev];
                        arr.splice(currentMediaIndex, 1);
                        const nextIdx = Math.min(
                          arr.length - 1,
                          currentMediaIndex
                        );
                        setCurrentMediaIndex(Math.max(0, nextIdx));
                        if (arr.length === 0) {
                          return [
                            {
                              id: "new-0",
                              type: "image",
                              source: "new",
                              data: "",
                            },
                          ];
                        }
                        return arr;
                      });
                    }}
                    disabled={
                      mediaItems.length === 0 ||
                      (mediaItems.length === 1 && !mediaItems[0].data)
                    }
                    title="Remover mídia"
                  >
                    -
                  </button>
                </div>
              </div>
              <div
                className="flex h-80 items-center justify-center rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                onPaste={handlePaste}
              >
                {currentMediaPreview && mediaItems[currentMediaIndex] ? (
                  mediaItems[currentMediaIndex].type === "video" ? (
                    <video
                      src={currentMediaPreview}
                      controls
                      className="h-full w-full rounded object-contain"
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={currentMediaPreview}
                      alt="preview"
                      className="h-full w-full rounded bg-white object-contain"
                    />
                  )
                ) : (
                  <div className="relative flex h-full w-full flex-col items-center justify-center">
                    <span className="text-gray-500">
                      Clique aqui e cole uma imagem, ou clique no botão para
                      anexar um arquivo de mídia
                    </span>
                    <div className="absolute bottom-2 right-2 mt-2 flex justify-end gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/mp4,video/webm"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(f);
                        }}
                      />
                      <button
                        className="rounded bg-gray-200 px-3 py-1"
                        onClick={() => fileRef.current?.click()}
                      >
                        Anexar mídia
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {!isDraftNew && (
            <>
              <button
                className="rounded-full bg-red-500 px-4 py-2 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting || saving}
              >
                Excluir
              </button>
              <button
                className="rounded-full bg-sky-500 px-4 py-2 text-white hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700"
                onClick={handleClone}
                disabled={deleting || saving}
              >
                Clonar
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            onClick={onBack}
            disabled={saving || deleting}
          >
            Voltar
          </button>
          <button
            className={`rounded-full bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 ${!isValidForm() && "cursor-not-allowed"}`}
            onClick={handleSave}
            disabled={saving || deleting}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded bg-white p-6 shadow-lg dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold">Confirmar exclusão</h2>
            <p className="mb-2">
              Tem certeza que deseja excluir este agendamento?
            </p>
            <p className="mb-6 text-red-600 dark:text-red-400">
              Esta ação não poderá ser desfeita!
            </p>
            <div className="flex justify-between gap-2">
              <button
                className="rounded bg-gray-200 px-4 py-2"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="rounded bg-red-500 px-4 py-2 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleDetailsPage;
