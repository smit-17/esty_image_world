import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Database, Lock, Palette, Store, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGate } from "@/lib/gate";
import {
  addEtsyAccount,
  deleteEtsyAccount,
  fetchEtsyAccountRows,
  fetchImages,
  fetchProducts,
  formatBytes,
} from "@/lib/lepdo";


export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Workspace access, brand palette and library details for LEPDO Lifestyle.",
      },
      { property: "og:title", content: "Settings — LEPDO Lifestyle" },
      { property: "og:description", content: "Workspace access and brand details for LEPDO Lifestyle." },
    ],
  }),
  component: SettingsPage,
});

const PALETTE = [
  { name: "Primary Green", hex: "#0E5A37" },
  { name: "Ivory / Cream", hex: "#F4E7C8" },
  { name: "Soft Ivory", hex: "#FBF8F2" },
  { name: "Warm Gold", hex: "#C9A35B" },
];

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <h3 className="text-lg">{title}</h3>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EtsyAccountsCard() {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery({
    queryKey: ["etsy-account-rows"],
    queryFn: fetchEtsyAccountRows,
  });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    try {
      await addEtsyAccount(value);
      setName("");
      await queryClient.invalidateQueries();
      toast.success("Etsy account added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await deleteEtsyAccount(id);
      await queryClient.invalidateQueries();
      toast.success("Etsy account removed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card title="Etsy accounts" icon={Store}>
      <p className="text-sm text-muted-foreground">
        Accounts added here appear in the Etsy account dropdown on every product.
      </p>
      <form onSubmit={add} className="mt-4 flex flex-wrap gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. LepdoLifestyleStore"
          maxLength={120}
          className="h-11 min-w-48 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl px-5">
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <ul className="mt-4 divide-y divide-border">
        {accounts.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">No Etsy accounts yet.</li>
        )}
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-3">
            <span className="text-sm">{a.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {products.filter((p) => (p.etsy_account ?? "") === a.name).length} listings
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove(a.id)}
              aria-label={`Remove ${a.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SettingsPage() {
  const { lock } = useGate();
  const navigate = useNavigate();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: images = [] } = useQuery({ queryKey: ["images", "all"], queryFn: () => fetchImages() });
  const used = images.reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);


  return (
    <div className="space-y-7">
      <header>
        <p className="text-eyebrow">Workspace</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Settings</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Access" icon={KeyRound}>
          <p className="text-sm text-muted-foreground">
            The workspace is protected by a single shared password used by the whole team. Lock the
            workspace when you step away from a shared device.
          </p>
          <Button
            variant="outline"
            className="mt-5 rounded-full px-6"
            onClick={() => {
              lock();
              navigate({ to: "/", replace: true });
            }}
          >
            <Lock className="size-4" /> Lock workspace
          </Button>
        </Card>

        <EtsyAccountsCard />



        <Card title="Library" icon={Database}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Products</dt>
              <dd>{products.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Images</dt>
              <dd>{images.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Storage used</dt>
              <dd>{formatBytes(used)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Brand palette" icon={Palette}>
          <ul className="grid grid-cols-2 gap-3">
            {PALETTE.map((c) => (
              <li key={c.hex} className="flex items-center gap-3">
                <span
                  className="size-9 rounded-xl border border-border"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm">{c.name}</p>
                  <p className="text-xs uppercase text-muted-foreground">{c.hex}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
