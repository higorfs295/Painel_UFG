// Botão do site — o Button (v0.2.0) do tremorlabs/template-solar (MIT), que só tem tema
// claro (o site é claro mesmo quando o sistema está escuro). Primário em orange-700: o
// orange-500 do template com texto branco dá 2,89:1; o 700 dá 5,23:1 (WCAG AA).
import { Slot } from "@radix-ui/react-slot";
import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx, focusRing } from "@/lib/utils";

const siteButton = tv({
  base: [
    "relative inline-flex items-center justify-center rounded-sm border px-3 py-2 text-center text-sm font-medium whitespace-nowrap shadow-xs transition-all duration-100 ease-in-out",
    "disabled:pointer-events-none disabled:shadow-none",
    focusRing,
  ],
  variants: {
    variant: {
      primary: "border-transparent bg-orange-700 text-white hover:bg-orange-800 disabled:bg-orange-300",
      secondary: "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:text-gray-400",
      ghost: "border-transparent bg-transparent text-gray-900 shadow-none hover:bg-gray-100",
    },
  },
  defaultVariants: { variant: "primary" },
});

type Props = React.ComponentPropsWithoutRef<"button"> & VariantProps<typeof siteButton> & { asChild?: boolean };

export const SiteButton = React.forwardRef<HTMLButtonElement, Props>(({ asChild, className, variant, ...props }, ref) => {
  const C = asChild ? Slot : "button";
  return <C ref={ref} className={cx(siteButton({ variant }), className)} {...props} />;
});
SiteButton.displayName = "SiteButton";
