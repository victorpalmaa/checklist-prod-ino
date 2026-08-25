import type { ReactNode } from "react";
import type { Database } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGateProps {
  allow: AppRole[];
  children: ReactNode;
}

export function RoleGate({ allow, children }: RoleGateProps) {
  const { profile } = useAuth();

  if (!profile || !allow.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
