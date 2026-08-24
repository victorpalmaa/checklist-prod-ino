import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import { AppShell } from "@/components/shell/AppShell";
import { DesignSystem } from "@/pages/DesignSystem";
import { Login } from "@/pages/Login";
import { ChecklistsList } from "@/pages/ChecklistsList";
import { ChecklistNew } from "@/pages/ChecklistNew";
import { ChecklistDetail } from "@/pages/ChecklistDetail";
import { ChecklistEdit } from "@/pages/ChecklistEdit";
import { AdminTemplates } from "@/pages/AdminTemplates";
import { AdminTemplateDetail } from "@/pages/AdminTemplateDetail";
import { Dashboard } from "@/pages/Dashboard";
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
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/checklists" replace />} />
          <Route path="/checklists" element={<ChecklistsList />} />
          <Route path="/checklists/novo" element={<ChecklistNew />} />
          <Route path="/checklists/:id" element={<ChecklistDetail />} />
          <Route path="/checklists/:id/editar" element={<ChecklistEdit />} />
          <Route path="/admin/templates" element={<AdminTemplates />} />
          <Route
            path="/admin/templates/:id"
            element={<AdminTemplateDetail />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {import.meta.env.DEV && (
          <Route path="/design-system" element={<DesignSystem />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
