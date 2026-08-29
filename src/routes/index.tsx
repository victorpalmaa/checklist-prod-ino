import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/shell/AppShell";
import { Login } from "@/pages/Login";
import { ChecklistsList } from "@/pages/ChecklistsList";
import { ChecklistTypeSelect } from "@/pages/ChecklistTypeSelect";
import { ChecklistTypePlaceholder } from "@/pages/ChecklistTypePlaceholder";
import { ChecklistNew } from "@/pages/ChecklistNew";
import { ChecklistDetail } from "@/pages/ChecklistDetail";
import { ChecklistEdit } from "@/pages/ChecklistEdit";
import { NotFound } from "@/pages/NotFound";

// Telas administrativas e de diagnostico saem do bundle inicial: sao
// acessadas por poucos usuarios e raramente, enquanto o caminho do
// operador (listar, criar, preencher, assinar) segue estatico para nao
// pagar latencia de chunk no chao de fabrica.
const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const AuditLog = lazy(() =>
  import("@/pages/AuditLog").then((m) => ({ default: m.AuditLog })),
);
const AdminUsers = lazy(() =>
  import("@/pages/AdminUsers").then((m) => ({ default: m.AdminUsers })),
);
const AdminTemplates = lazy(() =>
  import("@/pages/AdminTemplates").then((m) => ({ default: m.AdminTemplates })),
);
const AdminTemplateDetail = lazy(() =>
  import("@/pages/AdminTemplateDetail").then((m) => ({
    default: m.AdminTemplateDetail,
  })),
);
const DesignSystem = lazy(() =>
  import("@/pages/DesignSystem").then((m) => ({ default: m.DesignSystem })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span className="text-caption text-[var(--color-fg-muted)]">
        Carregando...
      </span>
    </div>
  );
}

function Shell() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="/" element={<Navigate to="/checklists" replace />} />
            <Route path="/checklists" element={<ChecklistsList />} />
            <Route
              path="/checklists/novo"
              element={<ChecklistTypeSelect />}
            />
            <Route
              path="/checklists/novo/po"
              element={<ChecklistNew />}
            />
            <Route
              path="/checklists/novo/gel"
              element={<ChecklistNew />}
            />
            <Route
              path="/checklists/novo/capsula"
              element={<ChecklistNew />}
            />
            <Route
              path="/checklists/novo/goma"
              element={<ChecklistTypePlaceholder />}
            />
            <Route path="/checklists/:id" element={<ChecklistDetail />} />
            <Route
              path="/checklists/:id/editar"
              element={<ChecklistEdit />}
            />
            <Route path="/admin/templates" element={<AdminTemplates />} />
            <Route
              path="/admin/templates/:id"
              element={<AdminTemplateDetail />}
            />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auditoria" element={<AuditLog />} />
            <Route path="/admin/usuarios" element={<AdminUsers />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        {import.meta.env.DEV && (
          <Route
            path="/design-system"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DesignSystem />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
