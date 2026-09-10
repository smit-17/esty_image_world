import { useRef, useState } from "react";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RefImage } from "@/components/finding/RefImage";
import { uploadFindingImage } from "@/lib/findings";
import { cn } from "@/lib/utils";

/**
 * Uploads reference images straight into the existing findings bucket and
 * hands back the stored paths. Nothing is written to the database here.
 */
export function ImageUploadArea({
  images,
  main,
  onChange,
  onStatusChange,
}: {
  images: string[];
  main: string;
  onChange: (images: string[], main: string) => void;
  onStatusChange?: (status: { uploading: number; failed: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState(0);

  const report = (up: number, fail: number) => {
    setUploading(up);
    setFailed(fail);
    onStatusChange?.({ uploading: up, failed: fail });
  };

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    report(list.length, 0);
    const stored: string[] = [];
    let fails = 0;
    for (const file of list) {
      try {
        const { path } = await uploadFindingImage(file);
        stored.push(path);
      } catch {
        fails += 1;
      }
      report(list.length - stored.length - fails, fails);
    }
    if (fails) toast.error(`${fails} image(s) could not be saved.`);
    const next = [...images, ...stored];
    onChange(next, main || next[0] || "");
    report(0, 0);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9"
        disabled={uploading > 0}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {uploading > 0 ? `Saving ${uploading}…` : "Add images"}
      </Button>
      {failed > 0 ? (
        <p className="text-[11px] text-destructive">{failed} image(s) failed. Try again.</p>
      ) : null}

      {images.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {images.map((ref) => (
            <div
              key={ref}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg border bg-secondary",
                ref === main ? "border-primary ring-1 ring-ring" : "border-border",
              )}
            >
              <RefImage refSrc={ref} alt="Reference image" />
              <button
                type="button"
                title="Use as main image"
                aria-label="Use as main image"
                onClick={() => onChange(images, ref)}
                className="absolute left-1 top-1 rounded-md bg-card/90 p-1 text-primary"
              >
                <Star className={cn("size-3.5", ref === main && "fill-current")} />
              </button>
              <button
                type="button"
                title="Remove image"
                aria-label="Remove image"
                onClick={() => {
                  const next = images.filter((i) => i !== ref);
                  onChange(next, main === ref ? (next[0] ?? "") : main);
                }}
                className="absolute right-1 top-1 rounded-md bg-card/90 p-1 text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
