import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LABEL: Record<string, string> = {
  gel: "Gel",
  capsula: "Cápsula",
  goma: "Goma",
};

export function ChecklistTypePlaceholder() {
  const { tipo } = useParams<{ tipo: string }>();
  const label = (tipo && LABEL[tipo]) ?? tipo ?? "Este tipo";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display">{label}</h1>
        <p className="text-body text-[var(--color-fg-secondary)]">
          Este formulário está em desenvolvimento.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" asChild className="min-h-[44px] min-w-[140px]">
          <Link to="/checklists/novo">Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
