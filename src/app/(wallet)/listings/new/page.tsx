'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { env } from '@/app/config/env';
import { NewListingSchema, type NewListing, CreateListingResponseSchema } from '@/app/types/listing';
import { useWallet } from '@/app/contexts/WalletContext';

const FormSchema = NewListingSchema;

export default function NewListingPage(): React.JSX.Element {
  const router = useRouter();
  const { tokens: walletTokens, isConnected, isUnlocked } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<NewListing>({ address: '', symbol: '', name: '', decimals: 9 });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feeLabel = useMemo(() => `${env.NEXT_PUBLIC_LISTING_FEE_KTA} KTA`, []);

  const validate = (draft: NewListing): string | null => {
    const result = FormSchema.safeParse(draft);
    if (!result.success) {
      return result.error.issues.map((e) => e.message).join(', ');
    }
    return null;
  };

  const onNext = () => {
    setError(null);
    const maybeError = validate(form);
    if (maybeError) {
      setError(maybeError);
      return;
    }
    setStep((s) => (s === 1 ? 2 : 3));
  };

  const onPrev = () => setStep((s) => (s === 3 ? 2 : 1));

  const toBaseUnitsString = (amount: string, decimals: number): string => {
    const [whole, frac = ''] = amount.split('.');
    const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    const normalized = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
    return normalized;
  };

  const payFee = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      const provider = (globalThis as unknown as { keeta?: unknown }).keeta as any;
      if (!provider || typeof provider.getUserClient !== 'function') {
        throw new Error('Keeta wallet not installed');
      }
      const userClient = await provider.getUserClient();
      if (!userClient || typeof userClient.initBuilder !== 'function') {
        throw new Error('Wallet client not available');
      }
      const builder = userClient.initBuilder();

      const feeRecipient = env.NEXT_PUBLIC_LISTING_FEE_RECIPIENT;
      
      // Get base token from userClient (per Keeta SDK: base token is derived from network identifier)
      const baseToken = (userClient as any)?.baseToken;
      if (!baseToken) {
        throw new Error('Base token not available from wallet client');
      }
      
      // Extract base token address for Chrome messaging serialization
      // Base token can be used directly in SDK, but wallet extension needs serialized address
      let baseTokenAddress: string;
      if (typeof baseToken === 'string') {
        baseTokenAddress = baseToken;
      } else if (baseToken && typeof baseToken === 'object' && 'publicKeyString' in baseToken) {
        const pk = baseToken.publicKeyString;
        if (typeof pk === 'string') {
          baseTokenAddress = pk;
        } else if (pk && typeof pk === 'object' && 'get' in pk && typeof pk.get === 'function') {
          baseTokenAddress = pk.get();
        } else if (pk && typeof pk === 'object' && 'toString' in pk && typeof pk.toString === 'function') {
          baseTokenAddress = String(pk.toString());
        } else {
          throw new Error('Unable to extract base token address from publicKeyString');
        }
      } else {
        throw new Error('Base token format not recognized');
      }
      
      if (!baseTokenAddress || typeof baseTokenAddress !== 'string' || baseTokenAddress === '[object Object]') {
        throw new Error('Invalid base token address');
      }
      
      // Serialize for Chrome messaging (wallet extension pattern)
      const baseTokenRef = JSON.parse(JSON.stringify({ publicKeyString: baseTokenAddress }));
      
      const baseUnits = toBaseUnitsString(env.NEXT_PUBLIC_LISTING_FEE_KTA, 9);

      // Send listing fee to recipient using base token
      builder.send(feeRecipient, baseUnits, baseTokenRef);
      const result = await userClient.publishBuilder(builder);
      // Register listing for tracking only
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error('Failed to register listing');
      }
      const json = await res.json();
      const parsed = CreateListingResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error('Invalid response from register');
      }
      // Redirect to token detail page
      router.push(`/trade/token/${encodeURIComponent(parsed.data.listing.address)}`);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pay listing fee');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col h-full">
            <div className="@container/main flex flex-1 flex-col gap-2 overflow-auto">
              <div className="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
                <section className="relative z-30 glass rounded-lg border border-hairline p-4 md:p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h1 className="text-xl font-semibold text-foreground">List a Token</h1>
                      <p className="text-xs text-muted">Permissionless listing • Flat fee: {feeLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/trade" className="rounded-md bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-strong">Back to Listings</Link>
                    </div>
                  </div>
                </section>

                <div className="mx-auto w-full max-w-[1440px] space-y-6">
                  {error ? (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
                  ) : null}

                  {step === 1 && (
                    <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                      {!isConnected || !isUnlocked ? (
                        <div className="text-sm text-muted">Connect and unlock your Keeta wallet to select a token.</div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2">
                            <label className="text-xs text-muted">Select a token from your wallet</label>
                            <Select
                              value={form.address}
                              onValueChange={(address) => {
                                if (!address) {
                                  setForm({ address: '', symbol: '', name: '', decimals: 9 });
                                  return;
                                }
                                const token = walletTokens.find((t) => t.address === address) || null;
                                if (!token) {
                                  setForm({ address: '', symbol: '', name: '', decimals: 9 });
                                  return;
                                }
                                setForm({ address: token.address, symbol: token.ticker || token.name, name: token.name, decimals: token.decimals });
                              }}
                            >
                              <SelectTrigger className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-medium text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="!bg-popover border-hairline shadow-lg">
                                {walletTokens.map((t) => (
                                  <SelectItem key={t.address} value={t.address} className="text-foreground">
                                    {t.ticker || t.name} · {t.formattedAmount}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {form.address && (
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                              <div><span className="text-muted">Symbol</span><div className="font-semibold text-foreground">{form.symbol}</div></div>
                              <div><span className="text-muted">Name</span><div className="font-semibold text-foreground">{form.name}</div></div>
                              <div className="sm:col-span-2"><span className="text-muted">Address</span><div className="font-mono text-foreground">{form.address}</div></div>
                              <div><span className="text-muted">Decimals</span><div className="text-foreground">{form.decimals}</div></div>
                            </div>
                          )}

                          <div className="mt-6 flex items-center justify-end gap-2">
                            <button type="button" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={onNext} disabled={!form.address}>Review</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                      <div className="space-y-2 text-sm">
                        <div className="text-muted">Confirm your token details and listing fee destination.</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div><span className="text-muted">Symbol</span><div className="font-semibold text-foreground">{form.symbol}</div></div>
                          <div><span className="text-muted">Name</span><div className="font-semibold text-foreground">{form.name}</div></div>
                          <div><span className="text-muted">Address</span><div className="font-mono text-foreground">{form.address}</div></div>
                          <div><span className="text-muted">Decimals</span><div className="text-foreground">{form.decimals}</div></div>
                          <div className="sm:col-span-2"><span className="text-muted">Listing Fee</span><div className="text-foreground font-semibold">{feeLabel}</div></div>
                          <div className="sm:col-span-2"><span className="text-muted">Recipient</span><div className="font-mono text-foreground">{env.NEXT_PUBLIC_LISTING_FEE_RECIPIENT}</div></div>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-between gap-2">
                        <button type="button" className="rounded-md bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-strong" onClick={onPrev}>Back</button>
                        <button type="button" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={onNext}>Pay Fee</button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="glass rounded-lg border border-hairline p-4 md:p-6">
                      <div className="space-y-3">
                        <div className="text-sm text-muted">Confirm the wallet transaction to pay {feeLabel} to the listing recipient.</div>
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" className="rounded-md bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-strong" onClick={onPrev} disabled={isSubmitting}>Back</button>
                          <button
                            type="button"
                            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
                            onClick={async () => { await payFee(); }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Processing…' : `Pay ${feeLabel}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}


