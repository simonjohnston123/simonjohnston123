"use client";

import { useCallback, useMemo, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";
import { startOnboardingAction, refreshStatusAction } from "@/app/dashboard/l/[locationId]/payments/connect-actions";

/**
 * Placid-branded embedded Stripe onboarding. The business only ever sees the
 * Placid palette — Stripe's component is themed to match and mounted inside our
 * own card. The secret key stays on the server; the browser only handles the
 * publishable key + short-lived account-session secret.
 */
export function ConnectOnboarding({
  locationId,
  publishableKey,
}: {
  locationId: string;
  publishableKey: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const r = await startOnboardingAction(locationId);
    if ("error" in r) {
      setError(r.error);
      throw new Error(r.error);
    }
    setError(null);
    return r.clientSecret;
  }, [locationId]);

  const instance = useMemo(
    () =>
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
        appearance: {
          variables: {
            colorPrimary: "#c81fd6",
            colorBackground: "#ffffff",
            colorText: "#0f172a",
            colorSecondaryText: "#64748b",
            colorDanger: "#e11d48",
            borderRadius: "12px",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            spacingUnit: "9px",
          },
        },
      }),
    [publishableKey, fetchClientSecret],
  );

  const onExit = useCallback(async () => {
    await refreshStatusAction(locationId);
    // Reflect the new capability status in the surrounding page.
    if (typeof window !== "undefined") window.location.reload();
  }, [locationId]);

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <ConnectComponentsProvider connectInstance={instance}>
        <ConnectAccountOnboarding onExit={onExit} />
      </ConnectComponentsProvider>
    </div>
  );
}
