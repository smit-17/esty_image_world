import logo from "@/assets/lepdo-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="LEPDO Lifestyle"
      className={cn("rounded-2xl object-cover", className)}
    />
  );
}
