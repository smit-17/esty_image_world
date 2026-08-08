import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ETSY_STATUSES,
  etsyStatusLabel,
  fetchEtsyAccounts,
  fetchTeam,
  formatDate,
  updateEtsy,
  type EtsyStatus,
  type Product,
} from "@/lib/lepdo";
import { cn } from "@/lib/utils";

export function EtsyStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const value = status ?? "not_listed";
  const tone =
    value === "live"
      ? "bg-primary text-primary-foreground"
      : value === "draft"
        ? "bg-secondary text-primary"
        : value === "sold_out"
          ? "bg-gold/25 text-primary"
          : value === "deactivated"
            ? "bg-muted text-muted-foreground"
            : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[0.65rem] font-medium",
        tone,
        className,
      )}
    >
      {etsyStatusLabel(value)}
    </span>
  );
}

/** Compact status switcher for product cards. */
export function EtsyQuickStatus({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function change(status: EtsyStatus) {
    setSaving(true);
    try {
      await updateEtsy(product.id, {
        status,
        account: product.etsy_account ?? null,
        url: product.etsy_url ?? null,
        listedBy: product.etsy_listed_by ?? product.team_member,
        listedAt: product.etsy_listed_at ?? null,
      });
      await queryClient.invalidateQueries();
      toast.success(`Etsy status set to ${etsyStatusLabel(status)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select
      value={(product.etsy_status as string) ?? "not_listed"}
      onValueChange={(v) => change(v as EtsyStatus)}
      disabled={saving}
    >
      <SelectTrigger className="h-8 rounded-lg text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ETSY_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Full Etsy tracking panel for the product detail page. */
export function EtsyPanel({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["etsy-accounts"], queryFn: fetchEtsyAccounts });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });

  const [status, setStatus] = useState<EtsyStatus>((product.etsy_status as EtsyStatus) ?? "not_listed");
  const [account, setAccount] = useState(product.etsy_account ?? "");
  const [url, setUrl] = useState(product.etsy_url ?? "");
  const [listedBy, setListedBy] = useState(product.etsy_listed_by ?? product.team_member);
  const [date, setDate] = useState(
    product.etsy_listed_at ? product.etsy_listed_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus((product.etsy_status as EtsyStatus) ?? "not_listed");
    setAccount(product.etsy_account ?? "");
    setUrl(product.etsy_url ?? "");
    setListedBy(product.etsy_listed_by ?? product.team_member);
    setDate(
      product.etsy_listed_at
        ? product.etsy_listed_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
  }, [product]);

  async function save() {
    if (status !== "not_listed" && !account.trim()) {
      toast.error("Enter the Etsy account name first");
      return;
    }
    setSaving(true);
    try {
      await updateEtsy(product.id, {
        status,
        account: account.trim() || null,
        url: url.trim() || null,
        listedBy: listedBy || null,
        listedAt: date ? new Date(date).toISOString() : null,
      });
      await queryClient.invalidateQueries();
      toast.success("Etsy listing details saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className="size-4 text-gold" />
          <p className="text-eyebrow">Etsy listing</p>
        </div>
        <EtsyStatusBadge status={product.etsy_status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Listing status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as EtsyStatus)}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETSY_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Etsy account name</label>
          <Select value={account || undefined} onValueChange={setAccount}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Select Etsy account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Add accounts in Settings first
                </div>
              ) : (
                accounts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>


        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="etsy-url">
            Listing URL
          </label>
          <Input
            id="etsy-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.etsy.com/listing/…"
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="etsy-date">
            Listing date
          </label>
          <Input
            id="etsy-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Listed by</label>
          <Select value={listedBy} onValueChange={setListedBy}>
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button className="rounded-full px-6" disabled={saving} onClick={save}>
          {saving && <Loader2 className="size-4 animate-spin" />} Save Etsy details
        </Button>
        {product.etsy_url && (
          <a
            href={product.etsy_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4"
          >
            Open listing <ExternalLink className="size-3.5" />
          </a>
        )}
        {product.etsy_listed_at && (
          <span className="text-xs text-muted-foreground">
            Listed {formatDate(product.etsy_listed_at)}
            {product.etsy_listed_by ? ` by ${product.etsy_listed_by}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
