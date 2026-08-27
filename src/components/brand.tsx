import remiLogo from "@/assets/remi.png";
import { cn } from "@/lib/utils";

interface RemispaceBrandProps {
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function RemispaceBrand({ className, iconClassName, size = "md" }: RemispaceBrandProps) {
  const iconSizes = {
    sm: "size-4.5 -mx-1 -translate-y-[1px] rotate-[10deg]",
    md: "size-5.5 -mx-1.5 -translate-y-[1px] rotate-[10deg]",
    lg: "size-7 sm:size-8 -mx-2 -translate-y-0.5 rotate-[10deg]",
    xl: "size-9 sm:size-10 -mx-2.5 -translate-y-0.5 rotate-[10deg]",
  };

  const textSizes = {
    sm: "text-base font-bold tracking-tight",
    md: "text-lg sm:text-xl font-bold tracking-tight",
    lg: "text-2xl sm:text-3xl font-bold tracking-tight",
    xl: "text-3xl sm:text-4xl font-bold tracking-tight",
  };

  return (
    <span className={cn("font-display inline-flex items-center select-none text-current leading-none", textSizes[size], className)}>
      <span>Remispa</span>
      <img
        src={remiLogo}
        alt="c"
        width={32}
        height={32}
        className={cn("inline-block object-contain shrink-0 transition-transform", iconSizes[size], iconClassName)}
      />
      <span>e</span>
    </span>
  );
}
