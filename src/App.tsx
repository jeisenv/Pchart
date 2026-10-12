import { useEffect, useState } from "react";
import { TradingPage } from "./pages/TradingPage.tsx";
import { useAuthStore, useTradingStore } from "./services/store.tsx";

/**
 * OpenCharts entry point.
 *
 * The app boots into a read-only market terminal. No account or user is seeded;
 * order actions remain disabled until a real authenticated backend is configured.
 */
export function App() {
  const [ready, setReady] = useState(false);
  const startReadOnlySession = useAuthStore((s) => s.startReadOnlySession);
  const loadSymbols = useTradingStore((s) => s.loadSymbols);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      startReadOnlySession();
      await loadSymbols();
      if (!cancelled) setReady(true);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [startReadOnlySession, loadSymbols]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        Loading OpenCharts…
      </div>
    );
  }

  return <TradingPage />;
}
