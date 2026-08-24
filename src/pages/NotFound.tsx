import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-display">Página não encontrada</h1>
      <p className="text-body text-[var(--color-fg-secondary)]">
        A rota solicitada não existe ou foi movida.
      </p>
      <Link
        to="/checklists"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary)] px-4 text-[14px] font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
      >
        Voltar para Checklists
      </Link>
    </div>
  );
}
