import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";

import { ToastProvider } from "../../components/ui/toast-provider";
import { UndoQueueProvider } from "../../components/ui/undo-queue";
import { AuthProvider } from "../../modules/auth/auth-context";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 300_000,
            gcTime: 1_800_000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UndoQueueProvider>
          <AuthProvider>{children}</AuthProvider>
        </UndoQueueProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
