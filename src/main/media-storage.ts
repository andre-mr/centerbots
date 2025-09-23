import fs from "fs";
import path from "path";
import { app } from "electron";

// Base: <userData>/media
export function resolveBaseDir(): string {
  const base = path.join(app.getPath("userData"), "media");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

// Returns absolute path under base dir; guards against path traversal
export function resolveAbsolutePath(relPath: string): string {
  const base = resolveBaseDir();
  const abs = path.join(base, relPath.replace(/^\\+|^\/+/, ""));
  const normalizedBase = path.resolve(base);
  const normalizedAbs = path.resolve(abs);
  if (!normalizedAbs.startsWith(normalizedBase)) {
    throw new Error("Invalid media path");
  }
  return normalizedAbs;
}

export function sanitizeSlug(s: string | null | undefined): string {
  const base = (s || "").toLowerCase().trim();
  const ascii = base.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return (
    ascii
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

function ensureSubdir(kind: "image" | "video"): string {
  const dir = path.join(resolveBaseDir(), kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listExisting(
  kind: "image" | "video",
  scheduleId: number,
  slug: string
): number[] {
  const dir = ensureSubdir(kind);
  const prefix = `${scheduleId}-${slug}-`;
  const files = fs.readdirSync(dir);
  const seqs: number[] = [];
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const m = f.match(/-(\d+)\.[^.]+$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) seqs.push(n);
    }
  }
  return seqs.sort((a, b) => a - b);
}

export function getNextSeq(
  scheduleId: number,
  slug: string,
  kind: "image" | "video"
): number {
  const seqs = listExisting(kind, scheduleId, slug);
  return seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
}

export function inferKindFromPath(relPath: string): "image" | "video" {
  if (relPath.startsWith("image/")) return "image";
  if (relPath.startsWith("video/")) return "video";
  // fallback by extension
  if (/\.(mp4|webm)$/i.test(relPath)) return "video";
  return "image";
}

export function saveImageFromBase64(
  scheduleId: number,
  descriptionSlug: string,
  ext: string,
  base64: string
): string {
  const kind: "image" = "image";
  const dir = ensureSubdir(kind);
  const slug = sanitizeSlug(descriptionSlug);
  const seq = getNextSeq(scheduleId, slug, kind);
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const filename = `${scheduleId}-${slug}-${seq}.${safeExt}`;
  const abs = path.join(dir, filename);
  const buffer = Buffer.from(base64, "base64");
  fs.writeFileSync(abs, buffer);
  return `${kind}/${filename}`;
}

export function saveVideoFromBase64(
  scheduleId: number,
  descriptionSlug: string,
  ext: string,
  base64: string
): string {
  const kind: "video" = "video";
  const dir = ensureSubdir(kind);
  const slug = sanitizeSlug(descriptionSlug);
  const seq = getNextSeq(scheduleId, slug, kind);
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
  const filename = `${scheduleId}-${slug}-${seq}.${safeExt}`;
  const abs = path.join(dir, filename);
  const buffer = Buffer.from(base64, "base64");
  fs.writeFileSync(abs, buffer);
  return `${kind}/${filename}`;
}

export function copyFileToMedia(
  scheduleId: number,
  descriptionSlug: string,
  kind: "image" | "video",
  sourcePath: string
): string {
  const dir = ensureSubdir(kind);
  const slug = sanitizeSlug(descriptionSlug);
  const seq = getNextSeq(scheduleId, slug, kind);
  const ext =
    path.extname(sourcePath).replace(/^\./, "").toLowerCase() ||
    (kind === "video" ? "mp4" : "jpg");
  const filename = `${scheduleId}-${slug}-${seq}.${ext}`;
  const absDest = path.join(dir, filename);
  fs.copyFileSync(sourcePath, absDest);
  return `${kind}/${filename}`;
}

export function deleteMedia(relPath: string): void {
  const abs = resolveAbsolutePath(relPath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}
