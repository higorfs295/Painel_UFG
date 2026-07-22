// Botão de exportação CSV — o mesmo gesto em todas as tabelas do sistema.
// Exporta exatamente as linhas recebidas: se a tabela está filtrada, o arquivo sai filtrado.
import Button from "./Button";
import { downloadCSV, type Column } from "../../lib/csv";
import { IconDownload } from "./Icons";

type Props<T> = {
  name: string;            // base do nome do arquivo (a data é acrescentada)
  rows: T[];
  columns: Column<T>[];
  label?: string;
};

export default function ExportButton<T>({ name, rows, columns, label = "Exportar CSV" }: Props<T>) {
  return (
    <Button size="sm" variant="ghost" disabled={rows.length === 0}
      title={rows.length === 0 ? "Nada para exportar" : `Exportar ${rows.length} linha(s)`}
      onClick={() => downloadCSV(name, rows, columns)}>
      <IconDownload /> {label}
    </Button>
  );
}
