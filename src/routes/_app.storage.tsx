import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardDrive, Images, Gem } from "lucide-react";

import {
  fetchCategories,
  fetchImages,
  fetchProducts,
  formatBytes,
  STORAGE_QUOTA_BYTES,
} from "@/lib/lepdo";

export const Route = createFileRoute("/_app/storage")({
  head: () => ({
    meta: [
      { title: "Storage — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Track image storage usage across the LEPDO Lifestyle jewelry library.",
      },
      { property: "og:title", content: "Storage — LEPDO Lifestyle" },
      { property: "og:description", content: "Track image storage usage across the LEPDO library." },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: images = [] } = useQuery({ queryKey: ["images", "all"], queryFn: () => fetchImages() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const used = images.reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);
  const avg = images.length ? used / images.length : 0;

  const perCategory = categories
    .map((c) => {
      const ids = new Set(products.filter((p) => p.category === c.name).map((p) => p.id));
      const bytes = images
        .filter((i) => ids.has(i.product_id))
        .reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);
      return { name: c.name, bytes };
    })
    .sort((a, b) => b.bytes - a.bytes);
  const maxBytes = Math.max(1, ...perCategory.map((c) => c.bytes));

  return (
    <div className="space-y-7">
      <header>
        <p className="text-eyebrow">Insights</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Storage</h1>
      </header>

      <div className="surface p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow">Used</p>
            <p className="mt-1 text-stat text-4xl text-primary">{formatBytes(used)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {pct.toFixed(1)}% of {formatBytes(STORAGE_QUOTA_BYTES)} allowance
          </p>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all duration-700"
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total images", value: String(images.length), icon: Images },
          { label: "Products", value: String(products.length), icon: Gem },
          { label: "Average image size", value: formatBytes(avg), icon: HardDrive },
        ].map((s) => (
          <div key={s.label} className="surface p-5">
            <div className="flex items-start justify-between">
              <p className="text-eyebrow">{s.label}</p>
              <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
                <s.icon className="size-4" strokeWidth={1.75} />
              </span>
            </div>
            <p className="mt-4 text-stat text-2xl text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="surface p-6">
        <h3 className="text-lg">Storage by category</h3>
        <ul className="mt-5 space-y-3.5">
          {perCategory.map((c) => (
            <li key={c.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{formatBytes(c.bytes)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${(c.bytes / maxBytes) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
