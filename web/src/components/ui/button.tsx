"use client";

// Botão com variantes — a API de `variant`/`size` vem do padrão shadcn usado pelo
// visactor-next-template; as cores são os tokens do cerrado.
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  default: "border-input bg-card hover:bg-muted hover:border-ring/50 shadow-sm",
  primary: "bg-primary text-primary-foreground border-transparent hover:bg-primary/90 shadow-sm",
  ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "border-lock/40 text-lock bg-transparent hover:bg-lock/10 hover:border-lock",
  outline: "border-input bg-transparent hover:bg-muted",
};

const SIZES: Record<Size, string> = {
  sm: "gap-1.5 rounded-md px-2.5 py-1 text-xs [&_svg]:size-3.5",
  md: "gap-2 rounded-lg px-4 py-2 text-sm [&_svg]:size-4",
  icon: "rounded-lg p-2 [&_svg]:size-4",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center border font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,box-shadow] active:translate-y-px",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    />
  );
});

export default Button;
