import * as React from "react";

import { cn } from "@/lib/utils";

type LogoVariant = "color" | "white" | "mono";

interface LogoProps {
  variant?: LogoVariant;
  height?: number;
  className?: string;
}

const variantToSrc: Record<LogoVariant, string> = {
  color: "/brand/logo-pronutrition-symbol.png",
  white: "/brand/logo-white.svg",
  mono: "/brand/logo-mono.svg",
};

export function Logo({
  variant = "color",
  height = 32,
  className,
}: LogoProps) {
  const padding = height * 0.25;
  const totalHeight = height + padding * 2;
  const totalWidth = height * 3 + padding * 2;
  const src = variantToSrc[variant];

  const [hasFile, setHasFile] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setHasFile(true);
    };
    img.onerror = () => {
      if (!cancelled) setHasFile(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (hasFile === true) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        style={{
          height: totalHeight,
          width: totalWidth,
          padding: padding,
        }}
        aria-label="Pronutrition"
      >
        <img
          src={src}
          alt="Pronutrition"
          style={{
            height: height,
            width: "auto",
            display: "block",
            maxWidth: "100%",
          }}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-dashed rounded-[10px]",
        className
      )}
      style={{
        height: totalHeight,
        width: totalWidth,
        padding: padding,
        borderColor: "var(--color-border-strong)",
        backgroundColor: "var(--color-surface-subtle)",
      }}
      aria-label="Pronutrition (logo pendente)"
    >
      <span
        className="font-sans text-[12px] font-medium leading-none"
        style={{
          color: "var(--color-fg-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        logo
      </span>
    </span>
  );
}
