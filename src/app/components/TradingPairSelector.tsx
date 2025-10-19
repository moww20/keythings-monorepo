'use client';

import { useMemo } from 'react';

import { RefreshCcw, Repeat } from 'lucide-react';

import type { TokenCatalogEntry, TokenChoice, WalletTokenBalance } from '@/app/types/token';

export interface TokenSwapSelectorProps {
  tokenA: TokenChoice | null;
  tokenB: TokenChoice | null;
  catalog: TokenCatalogEntry[];
  walletBalances?: WalletTokenBalance[];
  onChange: (selection: { tokenA: TokenChoice | null; tokenB: TokenChoice | null }) => void;
  onRefreshCatalog?: () => void;
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function hydrateChoice(
  entry: TokenCatalogEntry,
  balances: WalletTokenBalance[] | undefined,
): TokenChoice {
  const normalizedSymbol = normalizeSymbol(entry.symbol);
  const balanceMatch = balances?.find((token) => normalizeSymbol(token.address) === normalizeSymbol(entry.address));
  return {
    ...entry,
    symbol: normalizedSymbol,
    isListed: true,
    balance: balanceMatch?.balance,
    formattedAmount: balanceMatch?.formattedAmount,
  } satisfies TokenChoice;
}

export function TokenSwapSelector({
  tokenA,
  tokenB,
  catalog,
  walletBalances,
  onChange,
  onRefreshCatalog,
}: TokenSwapSelectorProps): React.JSX.Element {
  const { listedChoices, walletOnlyChoices } = useMemo(() => {
    const listed = catalog.map((entry) => hydrateChoice(entry, walletBalances));
    const listedAddresses = new Set(listed.map((choice) => normalizeSymbol(choice.address)));

    const walletOnly = (walletBalances ?? [])
      .filter((token) => !listedAddresses.has(normalizeSymbol(token.address)))
      .map((token) => ({
        symbol: token.address.slice(0, 6).toUpperCase(),
        address: token.address,
        isListed: false,
        balance: token.balance,
        formattedAmount: token.formattedAmount,
      } satisfies TokenChoice));

    return {
      listedChoices: listed,
      walletOnlyChoices: walletOnly,
    };
  }, [catalog, walletBalances]);

  const handleSelect = (slot: 'tokenA' | 'tokenB', address: string) => {
    if (!address) {
      onChange({ tokenA: slot === 'tokenA' ? null : tokenA, tokenB: slot === 'tokenB' ? null : tokenB });
      return;
    }

    const normalized = normalizeSymbol(address);
    const nextChoice = [...listedChoices, ...walletOnlyChoices].find(
      (choice) => normalizeSymbol(choice.address) === normalized,
    );

    if (!nextChoice) {
      return;
    }

    if (slot === 'tokenA') {
      // Prevent duplicates; reset tokenB if collision occurs
      const conflict = tokenB && normalizeSymbol(tokenB.address) === normalized;
      onChange({ tokenA: nextChoice, tokenB: conflict ? null : tokenB });
    } else {
      const conflict = tokenA && normalizeSymbol(tokenA.address) === normalized;
      onChange({ tokenA: conflict ? null : tokenA, tokenB: nextChoice });
    }
  };

  const handleSwap = () => {
    onChange({ tokenA: tokenB, tokenB: tokenA });
  };

  const renderOptions = (
    choices: TokenChoice[],
    disabled: boolean,
    labelSuffix?: string,
  ): React.ReactNode => {
    if (choices.length === 0) {
      return (
        <option disabled value="__empty__">
          No tokens available
        </option>
      );
    }

    return choices.map((choice) => {
      const displayName = labelSuffix
        ? `${choice.symbol} ${labelSuffix}`
        : `${choice.symbol}${choice.formattedAmount ? ` · ${choice.formattedAmount}` : ''}`;
      return (
        <option key={choice.address} value={choice.address} disabled={disabled}>
          {displayName}
        </option>
      );
    });
  };

  const renderSelect = (
    label: string,
    slot: 'tokenA' | 'tokenB',
    selectedToken: TokenChoice | null,
  ) => {
    const value = selectedToken?.address ?? '';
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor={`${slot}-select`}>
          {label}
        </label>
        <select
          id={`${slot}-select`}
          value={value}
          onChange={(event) => handleSelect(slot, event.target.value)}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="">Select token</option>
          <optgroup label="Listed tokens">
            {renderOptions(listedChoices, false)}
          </optgroup>
          <optgroup label="Wallet (not listed)">
            {renderOptions(walletOnlyChoices, true, '(Not listed)')}
          </optgroup>
        </select>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Trading Tokens</span>
        {onRefreshCatalog ? (
          <button
            type="button"
            onClick={onRefreshCatalog}
            className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            <RefreshCcw className="h-3 w-3" />
            Refresh
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
        {renderSelect('Token A (You sell)', 'tokenA', tokenA)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            className="rounded-full border border-hairline bg-surface-strong p-2 text-muted transition-colors hover:border-accent hover:text-foreground"
            aria-label="Swap tokens"
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>
        {renderSelect('Token B (You buy)', 'tokenB', tokenB)}
      </div>
    </div>
  );
}

export default TokenSwapSelector;
