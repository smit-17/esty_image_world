import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, fetchTeam } from "@/lib/lepdo";

export const Route = createFileRoute("/_app/team")({
  head: () => ({
    meta: [
      { title: "Team — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Manage the LEPDO Lifestyle team members who catalogue AI jewelry imagery.",
      },
      { property: "og:title", content: "Team — LEPDO Lifestyle" },
      { property: "og:description", content: "Manage the team members of the LEPDO image studio." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const { error } = await supabase
      .from("team_members" as never)
      .insert({ name: value, email: email.trim() || null } as never);
    if (error) return toast.error(error.message);
    setName("");
    setEmail("");
    queryClient.invalidateQueries({ queryKey: ["team"] });
    toast.success("Team member added");
  }

  async function remove(id: string, memberName: string) {
    if (products.some((p) => p.team_member === memberName)) {
      return toast.error("Member has products assigned");
    }
    const { error } = await supabase.from("team_members" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["team"] });
    toast.success("Team member removed");
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-eyebrow">Settings</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Team</h1>
      </header>

      <form onSubmit={add} className="surface grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          maxLength={80}
          className="h-11 rounded-xl"
        />
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email (optional)"
          className="h-11 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl px-6">
          <Plus className="size-4" /> Add member
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const count = products.filter((p) => p.team_member === m.name).length;
          return (
            <div key={m.id} className="surface flex items-center gap-3 p-5">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email ?? `${count} products`}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => remove(m.id, m.name)}
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
