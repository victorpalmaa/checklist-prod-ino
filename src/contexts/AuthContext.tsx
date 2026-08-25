import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";

import { setSessionPersistence, supabase } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  loading: boolean;
  signIn(email: string, password: string, persist: boolean): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<Tables<"profiles"> | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchProfile = React.useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (error || !data || data.active === false) {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(data);
  }, []);

  const resolveSession = React.useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (nextUser) {
      await fetchProfile(nextUser.id);
    } else {
      setProfile(null);
    }
  }, [fetchProfile]);

  React.useEffect(() => {
    let cancelled = false;
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        await resolveSession(data.session);
      }
      if (active) {
        setLoading(false);
      }
    })().catch(() => {
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setLoading(true);
      resolveSession(nextSession).finally(() => {
        if (active) setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveSession]);

  const signIn = React.useCallback(
    async (email: string, password: string, persist: boolean) => {
      setSessionPersistence(persist);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    },
    []
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return ctx;
}
