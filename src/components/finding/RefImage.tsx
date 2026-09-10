import { ImageIcon } from "lucide-react";

import { useSignedUrl } from "@/components/finding/FindingThumb";

/** A reference is either a remote URL or a path inside our storage bucket. */
export function isImageRef(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isRemote(ref: string) {
  return /^https?:\/\//i.test(ref);
}

export function RefImage({
  refSrc,
  alt,
  onClick,
}: {
  refSrc: string;
  alt?: string;
  kind?: "thumb" | "full";
  onClick?: (url: string) => void;
}) {
  const remote = isRemote(refSrc);
  const signed = useSignedUrl(remote ? null : refSrc);
  const url = remote ? refSrc : signed;

  if (!url) {
    return (
      <div className="flex size-full items-center justify-center bg-secondary text-muted-foreground">
        <ImageIcon className="size-5" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      onClick={() => onClick?.(url)}
      className="size-full cursor-pointer object-cover"
    />
  );
}
