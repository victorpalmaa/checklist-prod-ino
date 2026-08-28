import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const OPTIONS: {
  slug: "po" | "gel" | "capsula" | "goma";
  label: string;
  available: boolean;
}[] = [
  { slug: "po", label: "Pó", available: true },
  { slug: "gel", label: "Gel", available: true },
  { slug: "capsula", label: "Cápsula", available: true },
  { slug: "goma", label: "Goma", available: false },
];

export function ChecklistTypeSelect() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display">Novo checklist</h1>
        <p className="text-body text-[var(--color-fg-secondary)]">
          Selecione o tipo de produto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((opt) => (
          <Card
            key={opt.slug}
            className={`min-h-[140px] border transition-colors duration-150 ${
              opt.available ? "cursor-pointer" : "cursor-not-allowed opacity-70"
            }`}
            onClick={() => {
              if (!opt.available) return;
              navigate(`/checklists/novo/${opt.slug}`);
            }}
          >
            <CardContent className="flex min-h-[140px] flex-col items-start justify-between p-5">
              <h2 className="text-heading text-[var(--color-fg)]">
                {opt.label}
              </h2>
              {opt.available ? (
                <span className="text-caption text-[var(--color-fg-secondary)]">
                  Ir para formulário
                </span>
              ) : (
                <Badge variant="purple" className="min-h-[26px]">
                  <span
                    className="mr-2 inline-flex h-[7px] w-[7px] rounded-full"
                    style={{ backgroundColor: "var(--color-brand)" }}
                    aria-hidden
                  />
                  Em desenvolvimento
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
