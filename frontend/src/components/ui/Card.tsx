// Painel/cartão base.
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & { tight?: boolean };

export default function Card({ tight, className = "", ...rest }: Props) {
  return <div className={["card", tight ? "tight" : "", className].filter(Boolean).join(" ")} {...rest} />;
}
