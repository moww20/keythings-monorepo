"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EstimatedBalance, { type KtaPriceData } from "@/app/components/EstimatedBalance";
import { useWallet } from "@/app/contexts/WalletContext";
import { SectionCards } from "@/components/section-cards";
import { TokensDataTable, schema } from "@/components/tokens-data-table";
import { formatAmountWithCommas } from "@/app/lib/token-utils";
import type { z } from "zod";

function resolveNetworkName(network: unknown): string {
  if (typeof network === "object" && network !== null) {
    const record = network as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.trim().length > 0) {
      return record.name;
    }
  }
  return "Keeta Network";
}

function formatUsd(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) {
    return "--";
  }
  return `$${formatAmountWithCommas((value as number).toFixed(2))}`;
}

function mapTokensToTable(
  tokens: ReturnType<typeof useWallet>["tokens"],
  network: unknown,
  isConnected: boolean,
  ktaPriceData: KtaPriceData | null,
): z.infer<typeof schema>[] {
  const networkName = resolveNetworkName(network);

  return tokens.map((token, index) => {
    const numericBalance = Number(token.formattedAmount.replace(/,/g, ""));
    const isBase = token.isBaseToken || token.ticker.toUpperCase() === "KTA";
    const usdFromProp = token.formattedUsdValue ? Number(token.formattedUsdValue.replace(/[$,]/g, "")) : null;
    const derivedUsd = isBase && Number.isFinite(numericBalance) && ktaPriceData
      ? numericBalance * ktaPriceData.usd
      : usdFromProp;

    return {
      id: index + 1,
      name: token.name || token.ticker,
      symbol: token.ticker,
      balance: `${token.formattedAmount} ${token.ticker}`,
      value: formatUsd(derivedUsd ?? usdFromProp ?? null),
      change24h:
        isBase && ktaPriceData && typeof ktaPriceData.usd_24h_change === "number"
          ? `${ktaPriceData.usd_24h_change >= 0 ? "+" : ""}${ktaPriceData.usd_24h_change.toFixed(2)}%`
          : "--",
      type: token.isBaseToken ? "Native" : "Token",
      status: isConnected ? "Active" : "Disconnected",
      network: networkName,
      icon: token.icon || null,
      fallbackIcon: token.fallbackIcon ?? null,
    } satisfies z.infer<typeof schema>;
  });
}

export default function DashboardClient(): JSX.Element {
  const {
    wallet,
    tokens,
    connectWallet,
    requestTransactionPermissions,
    hasTransactionPermissions,
    isWalletLoading,
    isTokensLoading,
    isTradingEnabled,
    tradingError,
  } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [ktaPriceData, setKtaPriceData] = useState<KtaPriceData | null>(null);
  const priceFetchInProgress = useRef(false);

  const handleConnectWallet = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await connectWallet();

      let permissionsGranted = hasTransactionPermissions;
      if (!permissionsGranted) {
        permissionsGranted = await requestTransactionPermissions();
      }

      if (!permissionsGranted) {
        console.warn("Transaction permissions were not granted; balance details may be limited.");
        return;
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      const message = (error as Error)?.message ?? "";
      if (!/rejected|denied/i.test(message)) {
        alert("Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [connectWallet, requestTransactionPermissions, hasTransactionPermissions, isConnecting]);

  const fetchKtaPrice = useCallback(async () => {
    if (typeof window === "undefined" || priceFetchInProgress.current) {
      return;
    }

    const provider = window.keeta;
    if (!provider) {
      return;
    }

    priceFetchInProgress.current = true;
    try {
      let priceData: unknown = null;
      if (typeof provider.getKtaPrice === "function") {
        priceData = await provider.getKtaPrice();
      } else if (typeof provider.request === "function") {
        try {
          priceData = await provider.request({ method: "keeta_getKtaPrice" });
        } catch (error) {
          console.warn("keeta_getKtaPrice request failed:", error);
        }
      }

      if (priceData && typeof priceData === "object") {
        const data = priceData as Record<string, unknown>;
        if (typeof data.usd === "number") {
          setKtaPriceData({
            usd: data.usd,
            usd_market_cap: typeof data.usd_market_cap === "number" ? data.usd_market_cap : undefined,
            usd_24h_vol: typeof data.usd_24h_vol === "number" ? data.usd_24h_vol : undefined,
            usd_24h_change: typeof data.usd_24h_change === "number" ? data.usd_24h_change : undefined,
          });
          return;
        }
      }

      setKtaPriceData(null);
    } catch (error) {
      console.error("Failed to fetch KTA price:", error);
      setKtaPriceData(null);
    } finally {
      priceFetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    if (wallet.connected && !wallet.isLocked) {
      void fetchKtaPrice();
    }
  }, [wallet.connected, wallet.isLocked, fetchKtaPrice]);

  const tokensTableData = useMemo(
    () => mapTokensToTable(tokens, wallet.network, wallet.connected && !wallet.isLocked, ktaPriceData),
    [tokens, wallet.network, wallet.connected, wallet.isLocked, ktaPriceData],
  );

  const estimatedBalanceProps = useMemo(
    () => ({
      balance: wallet.balance,
      isConnecting: isConnecting || isWalletLoading,
      onConnect: handleConnectWallet,
      onReceive: () => console.log("Receive clicked"),
      onSend: () => console.log("Send clicked"),
      onTransfer: () => console.log("Transfer clicked"),
      tokens,
      ktaPriceData,
      isTradingEnabled,
      tradingError,
      title: "Total Balance",
    }),
    [
      wallet.balance,
      isConnecting,
      isWalletLoading,
      handleConnectWallet,
      tokens,
      ktaPriceData,
      isTradingEnabled,
      tradingError,
    ],
  );

  const tokensCount = tokens.length;

  const showLoadingMessage = (isWalletLoading || isTokensLoading) && tokensTableData.length === 0;

  return (
    <>
      <SectionCards estimatedBalance={estimatedBalanceProps} tokensCount={tokensCount} ktaPriceData={ktaPriceData} />
      <div className="px-4 lg:px-6">
        <TokensDataTable data={tokensTableData} />
      </div>
      {showLoadingMessage && (
        <p className="px-4 text-sm text-muted-foreground">Loading wallet data…</p>
      )}
    </>
  );
}
