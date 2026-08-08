import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/ProductForm";
import { fetchProduct } from "@/lib/lepdo";

export const Route = createFileRoute("/_app/products/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit product — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Update details, notes and imagery for a LEPDO Lifestyle jewelry product.",
      },
      { property: "og:title", content: "Edit product — LEPDO Lifestyle" },
      { property: "og:description", content: "Update details, notes and imagery for a jewelry product." },
    ],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const { id } = useParams({ from: "/_app/products/$id/edit" });
  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });

  return (
    <div className="space-y-7">
      <Link
        to="/products/$id"
        params={{ id }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to product
      </Link>
      <header>
        <p className="text-eyebrow">Library</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Edit product</h1>
      </header>
      {product ? <ProductForm product={product} /> : <div className="surface h-64 animate-pulse" />}
    </div>
  );
}
