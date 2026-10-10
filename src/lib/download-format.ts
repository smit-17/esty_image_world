/**
 * Image download format preference.
 * Stored in localStorage so it persists per device until changed.
 * Default: JPEG.
 */

export type DownloadFormat = "jpeg" | "jpg" | "png" | "webp";

const KEY = "lepdo-download-format";
const FORMATS: DownloadFormat[] = ["jpeg", "jpg", "png", "webp"];

export const DOWNLOAD_FORMATS: { value: DownloadFormat; label: string }[] = [
  { value: "jpeg", label: "JPEG" },
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

export function getDownloadFormat(): DownloadFormat {
  try {
    const v = localStorage.getItem(KEY);
    if (v && FORMATS.includes(v as DownloadFormat)) return v as DownloadFormat;
  } catch {
    /* ignore */
  }
  return "jpeg";
}

export function setDownloadFormat(format: DownloadFormat) {
  try {
    localStorage.setItem(KEY, format);
  } catch {
    /* ignore */
  }
}

function mimeFor(format: DownloadFormat): string {
  return format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
}

/**
 * Convert an image blob to the selected download format via canvas.
 * Falls back to the original blob if conversion is not possible.
 * JPEG/JPG get a white background so transparency doesn't turn black.
 */
export async function convertImageBlob(
  blob: Blob,
  format: DownloadFormat,
): Promise<{ blob: Blob; ext: string }> {
  const ext = format === "jpeg" ? "jpeg" : format;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob, ext: blob.type.split("/")[1] ?? "webp" };
    if (format === "jpeg" || format === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeFor(format), 0.92),
    );
    if (out) return { blob: out, ext };
  } catch {
    /* fall through to original */
  }
  return { blob, ext: blob.type.split("/")[1] ?? "webp" };
}
