import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, fetchProducts } from "@/lib/lepdo";

export const Route = createFileRoute("/_app/categories")({
  head: () => ({
    meta: [
      { title: "Categories — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Manage jewelry categories used to organise the LEPDO Lifestyle image library.",
      },
      { property: "og:title", content: "Categories — LEPDO Lifestyle" },
      { property: "og:description", content: "Manage the jewelry categories of the LEPDO library." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const { error } = await supabase.from("categories" as never).insert({ name: value } as never);
    if (error) return toast.error(error.message);
    setName("");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Category added");
  }

  async function remove(id: string, categoryName: string) {
    if (products.some((p) => p.category === categoryName)) {
      return toast.error("Category is in use by existing products");
    }
    const { error } = await supabase.from("categories" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Category removed");
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-eyebrow">Settings</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Categories</h1>
      </header>

      <form onSubmit={add} className="surface flex flex-wrap gap-3 p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          maxLength={60}
          className="h-11 min-w-56 flex-1 rounded-xl"
        />
        <Button type="submit" className="h-11 rounded-xl px-6">
          <Plus className="size-4" /> Add category
        </Button>
      </form>

      <div className="surface divide-y divide-border">
        {categories.map((c) => {
          const count = products.filter((p) => p.category === c.name).length;
          return (
            <div key={c.id} className="flex items-center gap-3 px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
                <Tag className="size-4" strokeWidth={1.75} />
              </span>
              <span className="text-sm">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{count} products</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => remove(c.id, c.name)}
                aria-label={`Remove ${c.name}`}
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
