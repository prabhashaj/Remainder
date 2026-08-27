import remiLogo from "@/assets/remi.png";
import { cn } from "@/lib/utils";

interface RemispaceBrandProps {
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function RemispaceBrand({ className, iconClassName, size = "md" }: RemispaceBrandProps) {
  const iconSizes = {
    sm: "size-4.5 mx-[1px] -translate-y-[1px]",
    md: "size-5.5 mx-[1px] -translate-y-[1px]",
    lg: "size-6.5 sm:size-7.5 mx-0.5 -translate-y-0.5",
    xl: "size-8 sm:size-9 mx-0.5 -translate-y-0.5",
  };

  const textSizes = {
    sm: "text-base font-bold",
    md: "text-lg sm:text-xl font-bold",
    lg: "text-2xl sm:text-3xl font-bold",
    xl: "text-3xl sm:text-4xl font-bold",
  };

  return (
    <span className={cn("font-display tracking-tight inline-flex items-center select-none text-current", textSizes[size], className)}>
      <span>Remispa</span>
      <img
        src={remiLogo}
        alt="c"
        width={32}
        height={32}
        className={cn("inline-block object-contain transition-transform", iconSizes[size], iconClassName)}
      />
      <span>e</span>
    </span>
  );
}
