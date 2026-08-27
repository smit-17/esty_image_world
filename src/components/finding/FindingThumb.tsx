import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { signPaths } from "@/lib/lepdo";

const cache = new Map<string, string>();

export function useSignedUrl(path?: string | null) {
  const [url, setUrl] = useState<string | undefined>(() => (path ? cache.get(path) : undefined));

  useEffect(() => {
    let alive = true;
    if (!path) return setUrl(undefined);
    const hit = cache.get(path);
    if (hit) return setUrl(hit);
    signPaths([path]).then((map) => {
      if (!alive) return;
      if (map[path]) {
        cache.set(path, map[path]);
        setUrl(map[path]);
      }
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return url;
}

export function FindingThumb({
  path,
  size = 40,
  onClick,
}: {
  path?: string | null;
  size?: number;
  onClick?: () => void;
}) {
  const url = useSignedUrl(path);
  const style = { width: size, height: size };

  if (!url) {
    return (
      <span
        style={style}
        className="flex items-center justify-center rounded-lg bg-secondary text-muted-foreground"
      >
        <ImageIcon className="size-4" strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      style={style}
      onClick={onClick}
      className="rounded-lg object-cover"
    />
  );
}
