import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Trash2,
  ImageOff,
  Loader2,
  ExternalLink,
  MoreVertical,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { EtsyPanel } from "@/components/EtsyPanel";
import { EstimatePanel, estimateTotals } from "@/components/EstimateSummary";
import { QcBadge } from "@/components/QcBadge";
import { ReferenceImages } from "@/components/ReferenceImages";
import {
  ImageQcControls,
  ImageSelectBox,
  imageQcOf,
  useImageQcMutation,
} from "@/components/ImageQc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/CopyInfo";
import { useAuth } from "@/lib/auth";
import { briefSections, buildChatGptBrief, buildFindingBrief, hasSourceInfo, sectionText } from "@/lib/finding-brief";
import {
  bulkAssign,
  deleteProduct,
  downloadProductImages,
  downloadSingleImage,
  
  fetchEstimates,
  fetchImages,
  fetchReferenceImages,
  fetchProduct,
  fetchTeam,
  formatBytes,
  QC_STATUSES,
  formatDate,
  signPaths,
  type ProductImage,
} from "@/lib/lepdo";



export const Route = createFileRoute("/_app/products/$id/")({
  head: () => ({
    meta: [
      { title: "Product detail — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "View every AI-generated image, note and detail for this LEPDO Lifestyle product.",
      },
      { property: "og:title", content: "Product detail — LEPDO Lifestyle" },
      { property: "og:description", content: "View images, notes and details for this jewelry product." },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = useParams({ from: "/_app/products/$id/" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const applyQc = useImageQcMutation(id);

  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });
  const { data: images = [] } = useQuery({
    queryKey: ["product-images", id],
    queryFn: () => fetchImages(id),
  });
  const { data: referenceImages = [] } = useQuery({
    queryKey: ["reference-images", id],
    queryFn: () => fetchReferenceImages(id),
  });
  const { data: estimates = [] } = useQuery({ queryKey: ["estimates"], queryFn: fetchEstimates });
  const estimate = estimates.find((e) => e.product_id === id);
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const { can } = useAuth();


  // Thumbnails for the grid — full-resolution images are only fetched on open/download.
  const thumbKeys = images.map((i) => i.thumb_path ?? i.path);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", thumbKeys.join(",")],
    queryFn: () => signPaths(thumbKeys),
    enabled: images.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const lightbox = lightboxIndex === null ? null : (images[lightboxIndex] ?? null);
  const { data: fullSigned = {} } = useQuery({
    queryKey: ["signed-full", lightbox?.path ?? ""],
    queryFn: () => signPaths([lightbox!.path]),
    enabled: !!lightbox,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const qcCounts = useMemo(() => {
    const c = { PENDING: 0, PASS: 0, HOLD: 0, REJECT: 0 } as Record<string, number>;
    images.forEach((i) => {
      const s = imageQcOf(i);
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [images]);

  const totalBytes = images.reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);

  // Everything transferred from a Finding, grouped for the collapsible sections.
  const sourceInfo = useMemo<[string, string | null | undefined][]>(() => {
    if (!product) return [];
    return (
      [
        ["Platform", product.source_platform],
        ["Brand / shop", product.source_brand],
        ["Seller", product.source_seller],
        ["Finding code", product.finding_code],
        ["Listing ID", product.source_listing_id],
        ["Source SKU", product.source_sku],
        ["Found by", product.source_found_by],
        ["Assigned to", product.source_assigned_to],
        ["Priority", product.source_priority],
      ] as [string, string | null | undefined][]
    ).filter(([, v]) => Boolean(v && String(v).trim()));
  }, [product]);

  const detailsBySection = useMemo(() => {
    const out: Record<string, [string, string][]> = {};
    (product?.source_details ?? []).forEach((d) => {
      if (!d?.value?.trim()) return;
      (out[d.section] ??= []).push([d.label, d.value]);
    });
    return out;
  }, [product]);

  async function confirmDelete() {
    try {
      await deleteProduct(id);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["images", "all"] });
      toast.success("Product deleted");
      navigate({ to: "/products" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function downloadAll() {
    if (!product) return;
    setZipping(true);
    setZipProgress(0);
    try {
      await downloadProductImages(product, images, (done, total) =>
        setZipProgress(Math.round((done / total) * 100)),
      );
      toast.success("Download ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  async function downloadOne(img: ProductImage, index: number) {
    if (!product) return;
    setDownloadingId(img.id);
    try {
      await downloadSingleImage(product, img, index);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  async function assignTo(member: string) {
    try {
      const res = await bulkAssign([id], member);
      if (res.failed.length) throw new Error(res.message ?? "Could not assign this product");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product", id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast.success(member ? `Assigned to ${member}` : "Unassigned");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!product) {
    return <div className="surface h-64 animate-pulse" />;
  }

  // The one brief for THIS product only — built from its own linked finding data.
  const sections = briefSections(product, referenceImages);
  const brief = buildFindingBrief(product, referenceImages);
  // One-click full brief — latest saved data, empty sections omitted.
  const chatGptBrief = buildChatGptBrief(product, {
    estimate,
    referenceImages,
    ourImagesCount: images.length,
    createdAt: formatDate(product.created_at),
  });
  const sectionCopy = (title: string) => {
    const s = sections.find((x) => x.title.startsWith(title));
    return s ? sectionText(s) : "";
  };

  const cover = images[0];
  const coverUrl = cover ? signed[cover.thumb_path ?? cover.path] : undefined;
  const stage =
    images.length === 0
      ? "Awaiting our images"
      : qcCounts.PASS !== images.length
        ? "Image QC in progress"
        : !estimateTotals(estimate).hasData
          ? "Ready for Metal & Diamond"
          : "Ready to list";

  // Our own images + the QC task sit at the very top of the page.
  const ourImagesPanel = (
    <Panel
      value="images"
      title={`Our Images — LEPDO / Original (${images.length})`}
      summary={`Pass ${qcCounts.PASS} · Pending ${qcCounts.PENDING} · Hold ${qcCounts.HOLD} · Reject ${qcCounts.REJECT}`}
    >
      {images.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ImageOff className="size-8 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No AI Images Yet</p>
          <Button asChild className="rounded-full px-5">
            <Link to="/products/$id/edit" params={{ id }}>
              + Add Images
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              LEPDO / Original
            </span>
            <span className="font-semibold tabular-nums">Images: {images.length}</span>
            <span className="tabular-nums text-emerald-700">Pass: {qcCounts.PASS}</span>
            <span className="tabular-nums text-muted-foreground">Pending: {qcCounts.PENDING}</span>
            <span className="tabular-nums text-amber-700">Hold: {qcCounts.HOLD}</span>
            <span className="tabular-nums text-destructive">Reject: {qcCounts.REJECT}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full"
                onClick={() =>
                  setSelected(selected.length === images.length ? [] : images.map((i) => i.id))
                }
              >
                {selected.length === images.length ? "Clear selection" : "Select all"}
              </Button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="surface sticky top-2 z-20 flex flex-wrap items-center gap-2 p-3">
              <span className="text-sm font-medium tabular-nums">{selected.length} selected</span>
              {QC_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={() => {
                    void applyQc(selected, s.value);
                    setSelected([]);
                  }}
                >
                  {s.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full"
                onClick={() => setSelected([])}
              >
                Cancel
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((img, index) => {
              const url = signed[img.thumb_path ?? img.path];
              const isSelected = selected.includes(img.id);
              return (
                <figure key={img.id} className="surface group overflow-hidden">
                  <div className="relative aspect-square">
                    <ImageSelectBox
                      checked={isSelected}
                      onChange={(v) =>
                        setSelected((cur) =>
                          v ? [...cur, img.id] : cur.filter((x) => x !== img.id),
                        )
                      }
                    />
                    {url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="size-full"
                        aria-label={`Open ${product.name} image`}
                      >
                        <img
                          src={url}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="size-full animate-pulse bg-muted" />
                    )}
                    <button
                      type="button"
                      onClick={() => downloadOne(img, index)}
                      disabled={downloadingId === img.id}
                      className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-primary opacity-0 shadow-soft transition-opacity group-hover:opacity-100"
                      aria-label="Download original image"
                    >
                      {downloadingId === img.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                    </button>
                  </div>
                  <figcaption className="border-t p-2">
                    <ImageQcControls
                      image={img}
                      onApply={(ids, status, extra) => void applyQc(ids, status, extra)}
                    />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );

  return (
    <div className="space-y-7">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to products
      </Link>

      {/* Compact header: thumbnail · SKU · stage · QC, with the actions people use most. */}
      <header className="surface flex flex-wrap items-center gap-4 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {coverUrl ? (
            <img src={coverUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-5 text-gold" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-eyebrow">{product.category}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold tabular-nums tracking-wide text-primary">
              SKU: {product.sku?.trim() || "—"}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {stage}
            </span>
            <QcBadge product={product} images={images} />
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {product.team_member} · {formatDate(product.created_at)} · {images.length} our images ·{" "}
            {formatBytes(totalBytes)}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CopyButton
            text={chatGptBrief}
            label="Copy All for ChatGPT"
            title={`${product.sku ?? product.name} — ready for ChatGPT`}
            className="px-5"
          />
          <Button asChild className="rounded-full px-5">
            <Link to="/products/$id/edit" params={{ id }}>
              + Add Images
            </Link>
          </Button>
          {hasSourceInfo(product) ? (
            <CopyButton
              text={brief}
              label="Copy Finding Info"
              title={`Finding info — ${product.sku ?? product.name}`}
              variant="secondary"
              className="px-5"
            />
          ) : (
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              No source information saved
            </span>
          )}
          {can("PRODUCT_UPDATE") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full px-5">
                  <UserRound className="size-4" /> Assign
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                {team.length === 0 && <DropdownMenuItem disabled>No team members</DropdownMenuItem>}
                {team.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => void assignTo(m.name)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void assignTo("")}>Unassign</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link to="/products/$id/edit" params={{ id }}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full" aria-label="More actions">
                {zipping ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreVertical className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {can("IMAGE_DOWNLOAD") && (
                <DropdownMenuItem
                  disabled={zipping || images.length === 0}
                  onSelect={() => void downloadAll()}
                >
                  <Download className="mr-2 size-4" />
                  {zipping ? `Zipping ${zipProgress}%` : `Download all (${images.length})`}
                </DropdownMenuItem>
              )}
              {can("PRODUCT_DELETE") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirming(true)}
                  >
                    <Trash2 className="mr-2 size-4" /> Delete product
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Accordion type="multiple" defaultValue={["images", "reference-images"]} className="space-y-3">
        {ourImagesPanel}

        <Panel value="info" title="Product Information" copy={sectionCopy("Product")}>
          <DetailRows
            rows={[
              ["Name", product.name],
              ["SKU", product.sku],
              ["Category", product.category],
              ["Subcategory", product.subcategory],
              ["Product type", product.product_type],
              ["Team member", product.team_member],
              ["Created", formatDate(product.created_at)],
              ["Last updated", formatDate(product.updated_at)],
              ["Images", `${images.length} · ${formatBytes(totalBytes)}`],
            ]}
          />
        </Panel>

        {sourceInfo.length > 0 && (
          <Panel value="source" title="Source / Finding" copy={sectionCopy("Source / Finding")}>
            <DetailRows rows={sourceInfo} />
            <div className="mt-3 flex flex-wrap gap-2">
              {product.source_url && (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <a href={product.source_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> Open original source
                  </a>
                </Button>
              )}
              {product.finding_id && (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link
                    to="/finding"
                    search={{ mode: "list" as const, q: product.finding_code ?? "" } as never}
                  >
                    <ExternalLink className="size-4" /> Open finding
                  </Link>
                </Button>
              )}
            </div>
          </Panel>
        )}

        {(referenceImages.length > 0 || product.finding_id) && (
          <Panel
            value="reference-images"
            title={`Reference Images (${referenceImages.length})`}
            summary="Fetched from the original source — reference only"
          >
            <ReferenceImages
              productId={id}
              productName={product.name}
              sourceUrl={product.source_url ?? product.reference_url}
            />
          </Panel>
        )}

        {(detailsBySection["Product Details"] || product.source_description) && (
          <Panel value="details" title="Product Details" copy={sectionCopy("Source description")}>
            {product.source_description && (
              <p className="mb-3 whitespace-pre-line text-sm leading-relaxed">
                {product.source_description}
              </p>
            )}
            <DetailRows rows={detailsBySection["Product Details"] ?? []} />
          </Panel>
        )}

        {(detailsBySection["Price & Variations"] || product.source_price) && (
          <Panel value="price" title="Price & Variations" copy={sectionCopy("Source price")}>
            <DetailRows
              rows={[
                ["Price", [product.source_price, product.source_currency].filter(Boolean).join(" ")],
                ...(detailsBySection["Price & Variations"] ?? []),
              ]}
            />
          </Panel>
        )}

        {(detailsBySection["Materials & Specs"] || (product.source_tags ?? []).length > 0) && (
          <Panel
            value="materials"
            title="Materials / Jewelry Details"
            copy={sectionCopy("Source specifications")}
          >
            <DetailRows rows={detailsBySection["Materials & Specs"] ?? []} />
            {(product.source_tags ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(product.source_tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        )}

        {(product.reference_url || product.source_url || detailsBySection["Shop & Ratings"]) && (
          <Panel value="links" title="Reference & Links">
            <DetailRows rows={detailsBySection["Shop & Ratings"] ?? []} />
            <div className="mt-2 space-y-2">
              {[
                ["Reference / inspiration link", product.reference_url],
                ["Original source link", product.source_url],
              ]
                .filter(([, url]) => Boolean(url))
                .map(([label, url]) => (
                  <div key={label as string} className="min-w-0">
                    <p className="text-eyebrow">{label}</p>
                    <a
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-primary underline underline-offset-4"
                    >
                      {url}
                    </a>
                  </div>
                ))}
            </div>
          </Panel>
        )}

        {product.notes?.trim() && (
          <Panel value="notes" title="Notes">
            <p className="whitespace-pre-line text-sm leading-relaxed">{product.notes}</p>
          </Panel>
        )}

        <Panel value="metal" title="Metal & Diamond">
          <EstimatePanel estimate={estimate} />
        </Panel>

        <Panel value="listing" title="Listing">
          <EtsyPanel product={product} />
        </Panel>
      </Accordion>




      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl p-2">
          {lightbox && (
            <div className="relative">
              {fullSigned[lightbox.path] ? (
                <img
                  src={fullSigned[lightbox.path]}
                  alt={product.name}
                  className="max-h-[80vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() =>
                      setLightboxIndex((i) => ((i ?? 0) - 1 + images.length) % images.length)
                    }
                    className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setLightboxIndex((i) => ((i ?? 0) + 1) % images.length)}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium tabular-nums text-primary">
                    {(lightboxIndex ?? 0) + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{product.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and all of its images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-full">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Panel({
  value,
  title,
  summary,
  copy,
  children,
}: {
  value: string;
  title: string;
  summary?: string;
  /** Optional plain text for this section's own small Copy button. */
  copy?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="surface overflow-hidden border-none px-5">
      <div className="flex items-center gap-2">
        <AccordionTrigger className="flex-1 py-4 hover:no-underline">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-left">
            <span className="text-sm font-semibold">{title}</span>
            {summary ? (
              <span className="text-xs tabular-nums text-muted-foreground">{summary}</span>
            ) : null}
          </span>
        </AccordionTrigger>
        {copy ? (
          <CopyButton text={copy} label="Copy" title={title} size="sm" variant="ghost" />
        ) : null}
      </div>
      <AccordionContent className="pb-5">{children}</AccordionContent>
    </AccordionItem>
  );
}

function DetailRows({ rows }: { rows: (string | null | undefined)[][] }) {
  const clean = rows.filter((r) => Boolean(r[1] && String(r[1]).trim()));
  if (clean.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {clean.map(([label, value]) => (
        <div key={label} className="flex min-w-0 gap-2 border-b border-border/50 py-1.5 text-sm">
          <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
