// Botão base com variantes (default/prim/ghost/warn) e tamanho.
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "prim" | "ghost" | "warn";
  size?: "md" | "sm";
};

export default function Button({ variant = "default", size = "md", className = "", ...rest }: Props) {
  const cls = ["btn", variant !== "default" ? variant : "", size === "sm" ? "sm" : "", className]
    .filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}
