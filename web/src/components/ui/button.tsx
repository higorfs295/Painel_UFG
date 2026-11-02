"use client";

// Botão das páginas antigas (API `variant`/`size` das versões anteriores) desenhado com o
// Tremor Raw Button. Novas telas podem importar direto `@/components/tremor/Button`.
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { buttonVariants } from "@/components/tremor/Button";
import { cx } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const MAP: Record<Variant, "primary" | "secondary" | "ghost"> = {
  default: "secondary", outline: "secondary", primary: "primary", ghost: "ghost", danger: "secondary",
};

const SIZES: Record<Size, string> = {
  sm: "gap-1.5 px-2 py-1 text-xs [&_svg]:size-3.5",
  md: "gap-2 [&_svg]:size-4",
  icon: "p-2 [&_svg]:size-4",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        buttonVariants({ variant: MAP[variant] }),
        "cursor-pointer disabled:opacity-60",
        // ação destrutiva leve: texto vermelho sobre o botão secundário (o sólido fica para o diálogo)
        variant === "danger" && "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10",
        variant === "ghost" && "text-gray-700 dark:text-gray-300",
        SIZES[size], className,
      )}
      {...props}
    />
  );
});

export default Button;
