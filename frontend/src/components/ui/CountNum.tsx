// Número que "conta" ao aparecer (usa useCountUp). `value` numérico; formatação pt-BR opcional.
import { useCountUp } from "../../hooks/useCountUp";

type Props = { value: number; decimals?: number; suffix?: string; className?: string };

export default function CountNum({ value, decimals = 0, suffix = "", className }: Props) {
  const n = useCountUp(value);
  const text = n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={className}>{text}{suffix}</span>;
}
