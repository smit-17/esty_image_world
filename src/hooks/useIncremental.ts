import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Render long lists progressively: start with `step` items and grow as the
 * sentinel scrolls into view. Keeps huge grids (600+ products) instant to open.
 */
export function useIncremental<T>(items: T[], step = 30) {
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying list changes (filters, search, sort).
  const key = items.length;
  useEffect(() => {
    setCount(step);
  }, [key, step]);

  const more = useCallback(() => {
    setCount((c) => (c >= items.length ? c : c + step));
  }, [items.length, step]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || count >= items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) more();
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [count, items.length, more]);

  return {
    visible: count >= items.length ? items : items.slice(0, count),
    hasMore: count < items.length,
    sentinel,
    more,
  };
}
