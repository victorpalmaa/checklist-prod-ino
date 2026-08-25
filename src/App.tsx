import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppRouter } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster
          richColors={false}
          closeButton
          position="top-right"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] p-4 pr-6 text-[14px]",
              title: "text-[14px] font-semibold text-[var(--color-fg)]",
              description:
                "text-[13px] text-[var(--color-fg-secondary)] leading-relaxed mt-0.5",
              actionButton:
                "inline-flex h-9 items-center justify-center rounded-[10px] bg-[var(--color-primary)] px-3 text-[12px] font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] min-w-[44px]",
              cancelButton:
                "inline-flex h-9 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-transparent px-3 text-[12px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)] min-w-[44px]",
              closeButton:
                "absolute right-1.5 top-1.5 rounded-[6px] p-1 text-[var(--color-fg-muted)] opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 h-8 w-8 inline-flex items-center justify-center",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
