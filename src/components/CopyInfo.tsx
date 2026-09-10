import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/finding-brief";
import { cn } from "@/lib/utils";

/**
 * Copies text and only shows "Copied" once the clipboard actually accepted it.
 * When the browser blocks clipboard access the full text opens in a selectable
 * box so nothing is silently lost.
 */
export function CopyButton({
  text,
  label = "Copy",
  title = "Copy information",
  size = "sm",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  title?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost" | "default";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function run() {
    if (!text.trim()) {
      toast.info("No information available to copy");
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } else {
      setFallback(true);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("rounded-full", className)}
        onClick={() => void run()}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : label}
      </Button>

      <Dialog open={fallback} onOpenChange={setFallback}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Your browser blocked automatic copying — select the text below and copy it manually.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={text} className="h-80 font-mono text-xs" />
        </DialogContent>
      </Dialog>
    </>
  );
}
