import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  X,
  GripVertical,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteImageRecords,
  fetchCategories,
  fetchImages,
  fetchTeam,
  signPaths,
  uploadImagesParallel,
  MAX_IMAGES,
  type Product,
  type ProductImage,
} from "@/lib/lepdo";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "done" | "error";

type Slot =
  | { kind: "existing"; id: string; path: string; preview: string }
  | {
      kind: "new";
      id: string;
      file: File;
      preview: string;
      state: UploadState;
      error?: string;
      uploaded?: { path: string; thumbPath: string; size: number };
    };

export function ProductForm({ product }: { product?: Product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!product;

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  // Scoped strictly to this product — a new product never inherits another's images.
  const { data: existing = [] } = useQuery({
    queryKey: ["product-images", product?.id ?? "new"],
    queryFn: () => fetchImages(product!.id),
    enabled: isEdit,
  });

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [member, setMember] = useState(product?.team_member ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [removed, setRemoved] = useState<ProductImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const replaceIndex = useRef<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit || !existing.length) return;
    let active = true;
    signPaths(existing.map((i) => i.thumb_path ?? i.path)).then((map) => {
      if (!active) return;
      setSlots(
        existing.map((i) => ({
          kind: "existing" as const,
          id: i.id,
          path: i.path,
          preview: map[i.thumb_path ?? i.path] ?? "",
        })),
      );
    });
    return () => {
      active = false;
    };
  }, [existing, isEdit]);

  const canSubmit = !!name.trim() && !!category && !!member && slots.length >= 1;

  function addFiles(files: FileList | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setSlots((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} images per product`);
        return prev;
      }
      const next = images.slice(0, room).map((file) => ({
        kind: "new" as const,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        state: "idle" as UploadState,
      }));
      if (images.length > room) toast.error(`Only ${room} more image(s) could be added`);
      return [...prev, ...next];
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const slot = prev[index];
      if (slot.kind === "existing") {
        const record = existing.find((i) => i.id === slot.id);
        if (record) setRemoved((r) => [...r, record]);
      } else {
        URL.revokeObjectURL(slot.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function startReplace(index: number) {
    replaceIndex.current = index;
    replaceInput.current?.click();
  }

  function applyReplace(file: File | undefined) {
    const index = replaceIndex.current;
    replaceIndex.current = null;
    if (!file || index === null) return;
    setSlots((prev) => {
      const slot = prev[index];
      if (!slot) return prev;
      if (slot.kind === "existing") {
        const record = existing.find((i) => i.id === slot.id);
        if (record) setRemoved((r) => [...r, record]);
      } else {
        URL.revokeObjectURL(slot.preview);
      }
      const next = [...prev];
      next[index] = {
        kind: "new",
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        state: "idle",
      };
      return next;
    });
  }

  function makeCover(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  }

  function reorder(from: number, to: number) {
    setSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function setSlotState(id: string, state: UploadState, error?: string) {
    setSlots((prev) =>
      prev.map((s) => (s.kind === "new" && s.id === id ? { ...s, state, error } : s)),
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      let productId = product?.id;

      if (productId) {
        const { error } = await supabase
          .from("products" as never)
          .update({ name: name.trim(), category, team_member: member, notes: notes.trim() || null } as never)
          .eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products" as never)
          .insert({ name: name.trim(), category, team_member: member, notes: notes.trim() || null } as never)
          .select("id")
          .single();
        if (error) throw error;
        productId = (data as unknown as { id: string }).id;
      }

      // Only upload files that haven't succeeded yet (retry-friendly).
      const pending = slots.filter(
        (s): s is Extract<Slot, { kind: "new" }> => s.kind === "new" && !s.uploaded,
      );
      const uploaded = pending.length
        ? await uploadImagesParallel(
            productId!,
            pending.map((s) => ({ id: s.id, file: s.file })),
            (id, state, error) => setSlotState(id, state, error),
          )
        : {};

      setSlots((prev) =>
        prev.map((s) =>
          s.kind === "new" && uploaded[s.id] ? { ...s, uploaded: uploaded[s.id] } : s,
        ),
      );

      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; position: number }[] = [];

      slots.forEach((slot, index) => {
        if (slot.kind === "existing") {
          updates.push({ id: slot.id, position: index });
          return;
        }
        const up = slot.uploaded ?? uploaded[slot.id];
        if (!up) return;
        inserts.push({
          product_id: productId,
          path: up.path,
          thumb_path: up.thumbPath,
          url: up.path,
          size_bytes: up.size,
          position: index,
        });
      });

      if (inserts.length) {
        const { error } = await supabase.from("product_images" as never).insert(inserts as never);
        if (error) throw error;
      }

      await Promise.all(
        updates.map((u) =>
          supabase
            .from("product_images" as never)
            .update({ position: u.position } as never)
            .eq("id", u.id),
        ),
      );

      // Delete removed images only after everything else succeeded.
      if (removed.length) await deleteImageRecords(removed);

      const first = slots[0];
      const coverPath =
        first?.kind === "existing"
          ? first.path
          : (first && (first.uploaded ?? uploaded[first.id])?.path) ?? null;

      await supabase
        .from("products" as never)
        .update({ cover_url: coverPath } as never)
        .eq("id", productId!);

      return productId!;
    },
    onSuccess: (id) => {
      // Reset the form so the next product starts completely empty.
      slots.forEach((s) => s.kind === "new" && URL.revokeObjectURL(s.preview));
      setSlots([]);
      setRemoved([]);
      if (!isEdit) {
        setName("");
        setCategory("");
        setMember("");
        setNotes("");
      }
      queryClient.invalidateQueries();
      toast.success(isEdit ? "Product updated successfully" : "Product saved successfully");
      navigate({ to: "/products/$id", params: { id } });
    },
    onError: (err: Error) => toast.error(err.message || "Could not save the product"),
  });

  const counter = useMemo(() => `${slots.length}/${MAX_IMAGES}`, [slots.length]);
  const failed = slots.filter((s) => s.kind === "new" && s.state === "error").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="surface space-y-5 p-6 lg:p-8">
        <h3 className="text-xl">Product details</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-eyebrow">Product name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Solitaire Halo Ring"
              maxLength={120}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-eyebrow">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-eyebrow">Team member</label>
            <Select value={member} onValueChange={setMember}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {team.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-eyebrow">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Styling notes, prompt details, variations…"
              maxLength={1000}
              className="min-h-24 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="surface space-y-5 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">Images</h3>
          <span className="text-xs text-muted-foreground">
            {counter} · at least 1 required
          </span>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center transition-colors",
            dragOver ? "border-gold bg-secondary" : "border-border bg-muted/40 hover:bg-secondary/60",
          )}
        >
          <UploadCloud className="size-7 text-gold" strokeWidth={1.5} />
          <p className="text-sm font-medium">Drag & drop images here</p>
          <p className="text-xs text-muted-foreground">
            or click to browse · up to {MAX_IMAGES} images · auto-optimised on upload
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>

        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            applyReplace(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />

        {slots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {slots.map((slot, index) => {
              const state = slot.kind === "new" ? slot.state : "done";
              return (
                <div
                  key={slot.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted"
                >
                  {slot.preview ? (
                    <img src={slot.preview} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <div className="size-full animate-pulse bg-muted" />
                  )}

                  {index === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-primary-foreground">
                      Cover
                    </span>
                  )}

                  {state === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  )}
                  {slot.kind === "new" && slot.state === "error" && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-destructive/90 px-2 py-1 text-[0.6rem] text-destructive-foreground">
                      <AlertCircle className="size-3" /> Failed — save again to retry
                    </div>
                  )}
                  {slot.kind === "new" && slot.state === "done" && (
                    <span className="absolute bottom-2 right-2 text-primary">
                      <CheckCircle2 className="size-4" />
                    </span>
                  )}

                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => makeCover(index)}
                        className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft"
                        aria-label="Set as cover image"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startReplace(index)}
                      className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft"
                      aria-label="Replace image"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        slot.kind === "existing" ? setPendingRemove(index) : removeSlot(index)
                      }
                      className="flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-soft"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <span className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-md bg-background/85 text-muted-foreground">
                    <GripVertical className="size-3.5" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {slots.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Drag tiles to reorder — the first image becomes the cover. Hover a tile to replace,
            re-cover or remove it.
          </p>
        )}
        {failed > 0 && (
          <p className="text-xs text-destructive">
            {failed} image(s) failed to upload. Press save again — only the failed ones are retried.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" className="rounded-full px-6" onClick={() => navigate({ to: "/products" })}>
          Cancel
        </Button>
        <Button
          className="rounded-full px-8"
          disabled={!canSubmit || save.isPending}
          onClick={() => !save.isPending && save.mutate()}
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add product"}
        </Button>
      </div>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this image?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be permanently deleted from this product when you save. Other products are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                if (pendingRemove !== null) removeSlot(pendingRemove);
                setPendingRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
