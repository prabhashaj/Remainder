import remiLogo from "@/assets/remi.png";
import { cn } from "@/lib/utils";

interface RemispaceBrandProps {
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function RemispaceBrand({ className, iconClassName, size = "md" }: RemispaceBrandProps) {
  const textSizes = {
    sm: "text-base",
    md: "text-lg sm:text-xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-3xl sm:text-4xl",
  };

  return (
    <span
      className={cn(
        "font-display inline-flex items-baseline font-bold tracking-tight select-none text-current leading-none",
        textSizes[size],
        className
      )}
    >
      <span className="leading-none">Remispa</span>
      <span className="inline-flex items-baseline -mx-[0.10em] relative">
        <img
          src={remiLogo}
          alt="c"
          className={cn(
            "inline-block h-[1.13em] w-auto max-w-none object-contain shrink-0 rotate-[15deg] translate-y-[0.16em] pointer-events-none transition-transform",
            iconClassName
          )}
        />
      </span>
      <span className="leading-none">e</span>
    </span>
  );
}
