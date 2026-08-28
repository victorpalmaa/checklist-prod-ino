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
import { DesignSystem } from "@/pages/DesignSystem";
import { Login } from "@/pages/Login";
import { ChecklistsList } from "@/pages/ChecklistsList";
import { ChecklistTypeSelect } from "@/pages/ChecklistTypeSelect";
import { ChecklistTypePlaceholder } from "@/pages/ChecklistTypePlaceholder";
import { ChecklistNew } from "@/pages/ChecklistNew";
import { ChecklistDetail } from "@/pages/ChecklistDetail";
import { ChecklistEdit } from "@/pages/ChecklistEdit";
import { AdminTemplates } from "@/pages/AdminTemplates";
import { AdminTemplateDetail } from "@/pages/AdminTemplateDetail";
const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
import { AuditLog } from "@/pages/AuditLog";
import { AdminUsers } from "@/pages/AdminUsers";
import { NotFound } from "@/pages/NotFound";

function Shell() {
  return (
    <AppShell>
      <Outlet />
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
            <Route
              path="/dashboard"
              element={
                <Suspense
                  fallback={
                    <div className="flex min-h-[40vh] items-center justify-center">
                      <span className="text-caption text-[var(--color-fg-muted)]">
                        Carregando...
                      </span>
                    </div>
                  }
                >
                  <Dashboard />
                </Suspense>
              }
            />
            <Route path="/auditoria" element={<AuditLog />} />
            <Route path="/admin/usuarios" element={<AdminUsers />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        {import.meta.env.DEV && (
          <Route path="/design-system" element={<DesignSystem />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
