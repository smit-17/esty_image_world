import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/ProductForm";

export const Route = createFileRoute("/_app/products/new")({
  head: () => ({
    meta: [
      { title: "Add product — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Upload AI-generated jewelry imagery and catalogue a new LEPDO Lifestyle product.",
      },
      { property: "og:title", content: "Add product — LEPDO Lifestyle" },
      { property: "og:description", content: "Upload jewelry imagery and catalogue a new product." },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  return (
    <div className="space-y-7">
      <header>
        <p className="text-eyebrow">Library</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Add product</h1>
      </header>
      <ProductForm />
    </div>
  );
}
