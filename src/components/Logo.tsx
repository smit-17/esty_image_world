import lifestylelogo from "@/assets/lifestylelogo.png";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={lifestylelogo}
      alt="LEPDO Lifestyle"
      className={cn("rounded-2xl object-cover", className)}
    />
  );
}
