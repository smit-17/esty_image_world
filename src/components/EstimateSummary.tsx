import type { ProductEstimate } from "@/lib/lepdo";

function num(v: unknown) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function estimateTotals(estimate?: ProductEstimate) {
  const gold = num(estimate?.gold_weight);
  const rows = estimate?.diamonds ?? [];
  const diamond = rows.reduce((s, r) => s + num(r.weight), 0);
  return { gold, diamond, rows: rows.length, hasData: gold > 0 || diamond > 0 };
}

/** Compact gold + diamond weights shown on product cards. */
export function EstimateLine({ estimate }: { estimate?: ProductEstimate }) {
  const { gold, diamond, hasData } = estimateTotals(estimate);
  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground">Weights pending</p>
    );
  }
  return (
    <p className="text-xs tabular-nums text-primary">
      14KT Gold: {gold.toFixed(2)} gm · Diamond: {diamond.toFixed(2)} ct
    </p>
  );
}

/** Detailed weight panel for the product detail page. */
export function EstimatePanel({ estimate }: { estimate?: ProductEstimate }) {
  const { gold, diamond, hasData } = estimateTotals(estimate);
  const rows = estimate?.diamonds ?? [];
  return (
    <div className="surface p-6">
      <p className="text-eyebrow">Metal &amp; Diamond Estimate</p>
      {hasData ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">14KT Gold</p>
              <p className="text-lg tabular-nums">{gold.toFixed(2)} gm</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Total Diamond</p>
              <p className="text-lg tabular-nums">{diamond.toFixed(2)} ct</p>
            </div>
          </div>
          {rows.length > 1 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {rows.map((r) => (
                <li key={r.id} className="tabular-nums">
                  {num(r.weight).toFixed(2)} ct{r.note ? ` · ${r.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No weights recorded yet — add them in Metal &amp; Diamond Estimate.
        </p>
      )}
    </div>
  );
}
