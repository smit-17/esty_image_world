import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="LEPDO Lifestyle"
      className={cn("rounded-2xl object-cover", className)}
    />
  );
}
