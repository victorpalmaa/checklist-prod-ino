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
        {/* toastOptions vive em components/ui/sonner.tsx. Passar outro
            aqui NAO faz merge: substitui o objeto inteiro e descarta as
            classNames do wrapper. Foi o que criava o circulo em volta do
            X, com h-8 w-8 somado a borda padrao do Sonner. */}
        <Toaster richColors={false} position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
