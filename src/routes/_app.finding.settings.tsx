import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users, Tags, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  clearFindingUser,
  fetchFindingMembers,
  fetchFindingOptions,
  getFindingUser,
} from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/settings")({
  head: () => ({
    meta: [
      { title: "Finding Settings — LEPDO Lifestyle" },
      { name: "description", content: "Manage finding team members, categories, platforms and styles." },
      { property: "og:title", content: "Finding Settings — LEPDO Lifestyle" },
      { property: "og:description", content: "Manage finding team members and dropdown lists." },
    ],
  }),
  component: () => (
    <FindingGate>
      <FindingSettingsPage />
    </FindingGate>
  ),
});

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

function MembersCard() {
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["finding-members"], queryFn: fetchFindingMembers });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const { error } = await supabase
      .from("finding_team_members" as never)
      .insert({ name: value, email: email.trim() || null } as never);
    if (error) return toast.error(error.message);
    setName("");
    setEmail("");
    queryClient.invalidateQueries({ queryKey: ["finding-members"] });
    toast.success("Team member added");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("finding_team_members" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["finding-members"] });
  }

  return (
    <Card title="Team members" icon={Users}>
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          maxLength={80}
          className="h-11 min-w-40 flex-1 rounded-xl"
        />
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          maxLength={160}
          className="h-11 min-w-40 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl px-5">
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <ul className="mt-4 divide-y divide-border">
        {members.length === 0 && <li className="py-3 text-sm text-muted-foreground">No members yet.</li>}
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <span className="text-sm">{m.name}</span>
            <span className="text-xs text-muted-foreground">{m.email}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => remove(m.id)}
              aria-label={`Remove ${m.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OptionsCard({ kind, title }: { kind: string; title: string }) {
  const queryClient = useQueryClient();
  const { data: options = [] } = useQuery({ queryKey: ["finding-options"], queryFn: fetchFindingOptions });
  const [value, setValue] = useState("");
  const rows = options.filter((o) => o.kind === kind);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    const { error } = await supabase.from("finding_options" as never).insert({ kind, value: v } as never);
    if (error) return toast.error(error.message);
    setValue("");
    queryClient.invalidateQueries({ queryKey: ["finding-options"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("finding_options" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["finding-options"] });
  }

  return (
    <Card title={title} icon={Tags}>
      <form onSubmit={add} className="flex flex-wrap gap-3">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Add ${title.toLowerCase()}`}
          maxLength={80}
          className="h-11 min-w-40 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl px-5">
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <ul className="mt-4 flex flex-wrap gap-2">
        {rows.map((o) => (
          <li key={o.id} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
            {o.value}
            <button onClick={() => remove(o.id)} aria-label={`Remove ${o.value}`} className="text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FindingSettingsPage() {
  const user = getFindingUser();
  return (
    <FindingLayout
      title="Finding Settings"
      actions={
        <>
          <span className="hidden text-xs text-muted-foreground sm:inline">Signed in as {user?.name}</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              clearFindingUser();
              window.location.reload();
            }}
          >
            <LogOut className="size-4" /> Switch user
          </Button>
        </>
      }
    >

      <div className="grid gap-3 lg:grid-cols-2">
        <MembersCard />
        <OptionsCard kind="category" title="Categories" />
        <OptionsCard kind="platform" title="Platforms" />
        <OptionsCard kind="style" title="Styles" />
      </div>
    </FindingLayout>
  );
}
