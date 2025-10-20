"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { KeetaProvider } from "@/types/keeta";

const DASHBOARD_PATH = "/dashboard";

export default function WalletRedirector(): null {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let provider: KeetaProvider | null = null;
    let detectionInterval: ReturnType<typeof setInterval> | null = null;

    const shouldSkipRedirect = () => {
      if (typeof window === "undefined") return false;
      const { pathname, search } = window.location;
      if (pathname === "/" || pathname === "") {
        return true;
      }
      try {
        const params = new URLSearchParams(search);
        return params.has("stayOnLanding");
      } catch {
        return false;
      }
    };

    const redirectToDashboard = () => {
      if (typeof window === "undefined") return;
      if (shouldSkipRedirect()) return;
      if (window.location.pathname !== DASHBOARD_PATH) {
        router.push(DASHBOARD_PATH);
      }
    };

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (Array.isArray(accounts) && accounts.length > 0) {
        redirectToDashboard();
      }
    };

    const handleConnect = (...args: unknown[]) => {
      redirectToDashboard();
    };

    const detachListeners = () => {
      if (!provider) return;
      const remove =
        (typeof provider.removeListener === "function" && provider.removeListener.bind(provider))
        || (typeof provider.off === "function" && provider.off.bind(provider));

      if (remove) {
        remove("accountsChanged", handleAccountsChanged);
        remove("connect", handleConnect);
      }
    };

    const attachListeners = () => {
      if (!provider) return;
      const on = typeof provider.on === "function" ? provider.on.bind(provider) : null;
      if (on) {
        on("accountsChanged", handleAccountsChanged);
        on("connect", handleConnect);
      }
    };

    const checkExistingConnection = async () => {
      if (!provider) return;
      try {
        // Only redirect if we're on the root page and wallet is connected
        // This prevents redirecting when user is already on a specific page
        if (window.location.pathname === "/" || window.location.pathname === "") {
          if (typeof provider.getAccounts === "function") {
            const accounts = await provider.getAccounts();
            if (Array.isArray(accounts) && accounts.length > 0) {
              redirectToDashboard();
              return;
            }
          }

          if (typeof provider.isConnected === "boolean" && provider.isConnected) {
            redirectToDashboard();
          } else if (typeof provider.isConnected === "function") {
            try {
              const connected = await provider.isConnected();
              if (connected) {
                redirectToDashboard();
              }
            } catch (error) {
              console.debug("Keeta provider isConnected check failed", error);
            }
          }
        }
      } catch (error) {
        console.debug("Keeta connection check failed", error);
      }
    };

    const initializeProvider = () => {
      provider = window.keeta ?? null;
      if (!provider) {
        return false;
      }

      attachListeners();
      void checkExistingConnection();
      return true;
    };

    if (!initializeProvider()) {
      detectionInterval = setInterval(() => {
        if (initializeProvider() && detectionInterval !== null) {
          clearInterval(detectionInterval);
        }
      }, 400);
    }

    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      detachListeners();
    };
  }, [router]);

  return null;
}
