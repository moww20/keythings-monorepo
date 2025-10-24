'use client';

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWallet } from "@/app/contexts/WalletContext";
import { formatTokenAmount, getTokenChipPresentation, toBaseUnits } from "@/app/lib/token-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Copy, Send, Users, Wallet } from "lucide-react";
import { NumericFormat } from "react-number-format";
import Toast from "@/app/components/Toast";
import { cn } from "@/lib/utils";

interface SendModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

interface TokenOption {
  value: string;
  label: string;
  description?: string;
  balance: string;
  formattedAmount: string;
  decimals: number;
  fieldType: "decimalPlaces" | "decimals";
  isBaseToken: boolean;
  iconUrl: string | null;
  fallbackIcon?: {
    letter?: string;
    bgColor?: string;
    textColor?: string;
    shape?: string;
  } | null;
}

interface ContactOption {
  label: string;
  address: string;
}

const formSchema = z.object({
  toAddress: z.string().min(1, "Recipient address is required"),
  token: z.string().min(1, "Select a token"),
  amount: z
    .string()
    .refine((value) => {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) && numeric > 0;
    }, { message: "Enter an amount greater than zero" }),
});

type SendTokenFormValues = z.infer<typeof formSchema>;

const SendModal = ({
  isOpen = false,
  onClose,
  inline = false,
  className,
  title,
  description,
}: SendModalProps) => {
  const {
    userClient,
    requestTransactionPermissions,
    hasTransactionPermissions,
    publicKey,
    isConnected,
    isUnlocked,
    isDisconnected,
    isLocked,
    tokens,
  } = useWallet();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedAddress = useMemo(() => {
    if (!publicKey) return "-";
    return `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`;
  }, [publicKey]);

  const primaryTokenOptions = useMemo<TokenOption[]>(() => {
    if (!tokens?.length) return [];

    return tokens.map((token) => {
      const presentation = getTokenChipPresentation(token);

      return {
        value: token.address,
        label: token.ticker || token.name,
        description: token.name,
        balance: token.balance,
        formattedAmount: token.formattedAmount,
        decimals: token.decimals,
        fieldType: token.fieldType,
        isBaseToken: token.isBaseToken,
        iconUrl: presentation.iconUrl,
        fallbackIcon: presentation.fallback ?? null,
      } satisfies TokenOption;
    });
  }, [tokens]);

  const defaultTokenValue = primaryTokenOptions[0]?.value ?? "";

  const form = useForm<SendTokenFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toAddress: "",
      token: defaultTokenValue,
      amount: "",
    },
  });
  const { errors, isSubmitted } = form.formState;

  useEffect(() => {
    const currentlySelected = form.getValues("token");
    if (!currentlySelected && defaultTokenValue) {
      form.setValue("token", defaultTokenValue, { shouldDirty: false });
    }
  }, [defaultTokenValue, form]);

  const contacts = useMemo<ContactOption[]>(() => {
    if (!publicKey) return [];
    return [{ label: "Wallet User", address: publicKey }];
  }, [publicKey]);

  const baseTokenTicker = useMemo(() => {
    const baseToken = tokens?.find((token) => token.isBaseToken);
    return baseToken?.ticker || baseToken?.name || "KTA";
  }, [tokens]);

  const selectedTokenAddress = form.watch("token");

  const selectedToken = useMemo(() => {
    if (!selectedTokenAddress) return null;
    return primaryTokenOptions.find((token) => token.value === selectedTokenAddress) ?? null;
  }, [selectedTokenAddress, primaryTokenOptions]);

  const availableBalance = selectedToken?.formattedAmount ?? null;
  const selectedTokenDecimals = selectedToken?.decimals ?? 0;
  const selectedTokenFieldType = selectedToken?.fieldType ?? "decimals";
  const selectedTokenLabel = selectedToken?.label ?? "Token";
  const selectedTokenRawBalance = selectedToken?.balance ?? "0";

  const operationFee = useMemo(() => {
    if (!selectedToken) return "Calculated at signing";
    return selectedToken.isBaseToken
      ? `${selectedTokenLabel} (base token)`
      : `${baseTokenTicker} (base token)`;
  }, [selectedToken, selectedTokenLabel, baseTokenTicker]);

  const resetFormState = useCallback((nextToken?: string) => {
    const tokenValue = nextToken ?? form.getValues("token") ?? defaultTokenValue;

    form.clearErrors();

    form.reset(
      {
        toAddress: "",
        token: tokenValue,
        amount: "",
      },
      {
        keepDirty: false,
        keepTouched: false,
        keepErrors: false,
        keepIsSubmitted: false,
        keepSubmitCount: false,
        keepValues: false,
      },
    );
  }, [defaultTokenValue, form]);

  const handleUseFullBalance = () => {
    if (!selectedToken) return;

    try {
      const formatted = formatTokenAmount(
        BigInt(selectedTokenRawBalance),
        selectedTokenDecimals,
        selectedTokenFieldType,
      ).replace(/,/g, "");

      form.setValue("amount", formatted, { shouldDirty: true, shouldValidate: true });

      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>("input[data-send-modal-amount]");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    } catch (err) {
      console.error("[SendModal] Failed to set full balance", err);
      Toast.error("Failed to use full balance. Please try again.");
    }
  };

  const handleSubmit = async (values: SendTokenFormValues) => {
    if (isDisconnected) {
      Toast.error("Wallet not connected. Please connect your Keeta wallet first.");
      return;
    }

    if (isLocked) {
      Toast.error("Wallet is locked. Please unlock your wallet to send tokens.");
      return;
    }

    if (!isConnected || !isUnlocked) {
      Toast.error("Wallet not ready. Please ensure your wallet is connected and unlocked.");
      return;
    }

    if (!hasTransactionPermissions) {
      Toast.error("Wallet requires transaction permissions. Grant access and try again.");
      await requestTransactionPermissions?.();
      return;
    }

    if (!userClient) {
      Toast.error("Wallet client not available. Please reconnect your wallet.");
      return;
    }

    if (!publicKey) {
      Toast.error("Wallet address not available. Please reconnect your wallet.");
      return;
    }

    setIsSubmitting(true);

    try {
      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error("Failed to initialize transaction builder. Please update your Keeta Wallet.");
      }

      if (typeof builder.send !== "function") {
        throw new Error("Wallet does not support send operations. Please update your Keeta Wallet.");
      }

      const tokenMetadata = primaryTokenOptions.find((token) => token.value === values.token);
      if (!tokenMetadata) {
        throw new Error("Selected token metadata not available.");
      }

      const toAccount = JSON.parse(JSON.stringify({ publicKeyString: values.toAddress }));
      const tokenRef = JSON.parse(JSON.stringify({ publicKeyString: values.token }));

      const amountInBaseUnits = toBaseUnits(values.amount, tokenMetadata.decimals).toString();

      builder.send(toAccount, amountInBaseUnits, tokenRef);

      if (typeof (builder as any).computeBlocks === "function") {
        await (builder as any).computeBlocks();
      }

      const receipt = await userClient.publishBuilder(builder);
      console.log("[SendModal] ✅ Transaction signed and submitted:", receipt);

      Toast.success(`Sent ${values.amount} ${selectedTokenLabel} to ${values.toAddress}`);

      resetFormState(values.token);

      setTimeout(() => {
        if (!inline) {
          onClose?.();
        }
      }, 1200);
    } catch (err) {
      console.error("[SendModal] Transaction failed:", err);
      const message = err instanceof Error ? err.message : "Transaction failed. Please try again.";
      Toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedTitle = title ?? "Send Token";
  const resolvedDescription = description ?? "Transfer tokens to another Keeta address.";

  const renderContent = () => (
    <>
      <Card className="border border-hairline bg-surface gap-0 py-0">
        <CardContent className="flex items-center gap-2.5 px-3.5 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-strong text-muted">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Wallet User</span>
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <span className="font-mono">{formattedAddress}</span>
              <button
                type="button"
                className="rounded-full p-0.5 transition hover:text-foreground"
                onClick={() => {
                  if (!publicKey) return;
                  navigator.clipboard.writeText(publicKey).catch((err) => {
                    console.warn("[SendModal] Failed to copy address", err);
                  });
                }}
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <fieldset disabled={isDisconnected || isLocked || !primaryTokenOptions.length} className="space-y-6">
            <FormField
              control={form.control}
              name="toAddress"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium text-foreground">To address</FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-3"
                          disabled={!contacts.length}
                        >
                          <Users className="h-3 w-3" />
                          Contacts
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[12rem]">
                        <DropdownMenuLabel>Recent contacts</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {contacts.map((contact) => (
                          <DropdownMenuItem
                            key={contact.address}
                            onSelect={() => {
                              form.setValue("toAddress", contact.address);
                            }}
                            className="flex flex-col items-start gap-1"
                          >
                            <span className="text-sm font-medium text-foreground">{contact.label}</span>
                            <span className="text-xs text-muted">{contact.address}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="Enter a valid Keeta address"
                      className="bg-surface text-sm text-foreground placeholder:text-foreground/60"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Amount ({selectedTokenLabel})</span>
                <button
                  type="button"
                  className="text-muted transition hover:text-foreground"
                  onClick={handleUseFullBalance}
                >
                  Available: {availableBalance ?? "0"}
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (isSubmitted) {
                          form.trigger("amount");
                        }
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-[8.5rem] justify-between bg-surface-strong">
                        <SelectValue placeholder="Token">
                          {selectedToken ? (
                            <div className="flex items-center gap-2">
                              {selectedToken.iconUrl ? (
                                <Image
                                  src={selectedToken.iconUrl}
                                  alt={selectedToken.label}
                                  width={20}
                                  height={20}
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : selectedToken.fallbackIcon ? (
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: selectedToken.fallbackIcon.bgColor ?? "rgba(255,255,255,0.08)",
                                    color: selectedToken.fallbackIcon.textColor ?? "var(--foreground)",
                                  }}
                                >
                                  {selectedToken.fallbackIcon.letter ?? selectedToken.label[0]}
                                </span>
                              ) : (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-strong text-[11px] font-semibold text-foreground">
                                  {selectedToken.label[0]}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground">{selectedToken.label}</span>
                            </div>
                          ) : (
                            "Token"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {primaryTokenOptions.map((tokenOption) => (
                          <SelectItem key={tokenOption.value} value={tokenOption.value}>
                            <div className="flex items-center gap-3">
                              {tokenOption.iconUrl ? (
                                <Image
                                  src={tokenOption.iconUrl}
                                  alt={tokenOption.label}
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : tokenOption.fallbackIcon ? (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                                  style={{
                                    backgroundColor: tokenOption.fallbackIcon.bgColor ?? "rgba(255,255,255,0.08)",
                                    color: tokenOption.fallbackIcon.textColor ?? "var(--foreground)",
                                  }}
                                >
                                  {tokenOption.fallbackIcon.letter ?? tokenOption.label[0]}
                                </span>
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-foreground">
                                  {tokenOption.label[0]}
                                </span>
                              )}
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-medium text-foreground">{tokenOption.label}</span>
                                <span className="text-xs text-muted">{tokenOption.formattedAmount}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />

                <div className="h-8 w-px bg-[color:color-mix(in_oklab,var(--foreground)_12%,transparent)]" />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => {
                    const { onChange, onBlur, value, name, ref } = field;

                    const decimalScale =
                      selectedTokenFieldType === "decimals" ? selectedTokenDecimals : undefined;

                    return (
                      <FormItem className="flex-1">
                        <FormControl>
                          <NumericFormat
                            value={value ?? ""}
                            name={name}
                            getInputRef={ref}
                            customInput={Input}
                            data-send-modal-amount
                            allowNegative={false}
                            allowLeadingZeros={false}
                            thousandSeparator
                            decimalSeparator="."
                            inputMode="decimal"
                            type="text"
                            decimalScale={decimalScale}
                            placeholder={
                              selectedToken ? `Enter ${selectedTokenLabel} amount` : "Enter amount"
                            }
                            className="flex-1 bg-surface-strong text-right text-lg font-medium text-foreground"
                            onValueChange={({ value: nextValue }) => {
                              onChange(nextValue ?? "");
                            }}
                            onBlur={onBlur}
                            onWheel={(event) => (event.target as HTMLInputElement).blur()}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {(errors.token || errors.amount) && (
                <div className="space-y-1 text-sm text-destructive">
                  {errors.token ? <p>{errors.token.message}</p> : null}
                  {errors.amount ? <p>{errors.amount.message}</p> : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Operation Fee</span>
              <span className="text-foreground">{operationFee}</span>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !primaryTokenOptions.length}
                className="w-full bg-accent text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>
    </>
  );

  if (inline) {
    return (
      <div className={cn("glass rounded-lg border border-hairline bg-[color:var(--background)] p-6 space-y-6", className)}>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">{resolvedTitle}</h2>
          <p className="text-sm text-muted">{resolvedDescription}</p>
        </div>
        {renderContent()}
      </div>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetFormState(defaultTokenValue);
          onClose?.();
        }
      }}
    >
      <DialogContent className="glass sm:max-w-lg border border-hairline bg-[color:var(--background)] p-0">
        <DialogHeader className="space-y-2 px-6 pt-6 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">{resolvedTitle}</DialogTitle>
          <DialogDescription className="text-sm text-muted">{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="px-6 pb-6 pt-4 space-y-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
export default SendModal;
