'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWallet } from "@/app/contexts/WalletContext";
import { getTokenChipPresentation, toBaseUnits } from "@/app/lib/token-utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import Toast from "@/app/components/Toast";

interface TokenOption {
  value: string;
  label: string;
  formattedAmount: string;
  decimals: number;
  fieldType: "decimalPlaces" | "decimals";
  iconUrl: string | null;
  fallbackIcon?: {
    letter?: string;
    bgColor?: string;
    textColor?: string;
    shape?: string;
  } | null;
}

const recipientSchema = z.object({
  address: z.string().min(1, "Recipient address is required"),
  amount: z
    .string()
    .refine((value) => {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) && numeric > 0;
    }, { message: "Enter an amount greater than zero" }),
});

const formSchema = z.object({
  token: z.string().min(1, "Select a token"),
  recipients: z
    .array(recipientSchema)
    .min(2, "Add at least two recipients")
    .max(5, "You can send to up to 5 recipients at once"),
});

type MultiSendFormValues = z.infer<typeof formSchema>;

const MultiSendForm = () => {
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

  const tokenOptions = useMemo<TokenOption[]>(() => {
    if (!tokens?.length) return [];

    return tokens.map((token) => {
      const presentation = getTokenChipPresentation(token);

      return {
        value: token.address,
        label: token.ticker || token.name,
        formattedAmount: token.formattedAmount,
        decimals: token.decimals,
        fieldType: token.fieldType,
        iconUrl: presentation.iconUrl,
        fallbackIcon: presentation.fallback ?? null,
      } satisfies TokenOption;
    });
  }, [tokens]);

  const defaultToken = tokenOptions[0]?.value ?? "";

  const form = useForm<MultiSendFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: defaultToken,
      recipients: [
        { address: "", amount: "" },
        { address: "", amount: "" },
      ],
    },
  });

  const { control, handleSubmit, getValues, formState, trigger, setValue } = form;

  useEffect(() => {
    if (!defaultToken) return;
    const currentToken = getValues("token");
    if (!currentToken) {
      setValue("token", defaultToken, { shouldDirty: false });
    }
  }, [defaultToken, getValues, setValue]);

  const fieldArray = useFieldArray({
    control,
    name: "recipients",
  });

  const addRecipient = useCallback(() => {
    if (fieldArray.fields.length >= 5) return;
    fieldArray.append({ address: "", amount: "" });
  }, [fieldArray]);

  const removeRecipient = useCallback(
    (index: number) => {
      if (fieldArray.fields.length <= 2) return;
      fieldArray.remove(index);
    },
    [fieldArray],
  );

  const resetForm = useCallback(() => {
    const tokenValue = getValues("token") || defaultToken;
    form.reset(
      {
        token: tokenValue,
        recipients: [
          { address: "", amount: "" },
          { address: "", amount: "" },
        ],
      },
      {
        keepIsSubmitted: false,
        keepDirty: false,
        keepTouched: false,
        keepErrors: false,
        keepSubmitCount: false,
        keepValues: false,
      },
    );
  }, [defaultToken, form, getValues]);

  const handleMultiSend = async (values: MultiSendFormValues) => {
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

    const tokenMetadata = tokenOptions.find((token) => token.value === values.token);

    if (!tokenMetadata) {
      Toast.error("Selected token metadata not available.");
      return;
    }

    setIsSubmitting(true);

    try {
      for (const recipient of values.recipients) {
        const builder = userClient.initBuilder();
        if (!builder) {
          throw new Error("Failed to initialize transaction builder. Please update your Keeta Wallet.");
        }

        if (typeof builder.send !== "function") {
          throw new Error("Wallet does not support send operations. Please update your Keeta Wallet.");
        }

        const toAccount = JSON.parse(JSON.stringify({ publicKeyString: recipient.address }));
        const tokenRef = JSON.parse(JSON.stringify({ publicKeyString: values.token }));

        const amountInBaseUnits = toBaseUnits(recipient.amount, tokenMetadata.decimals).toString();

        builder.send(toAccount, amountInBaseUnits, tokenRef);

        if (typeof (builder as any).computeBlocks === "function") {
          await (builder as any).computeBlocks();
        }

        await userClient.publishBuilder(builder);
        Toast.success(`Sent ${recipient.amount} ${tokenMetadata.label} to ${recipient.address}`);
      }

      resetForm();
    } catch (error) {
      console.error("[MultiSendForm] Transaction failed:", error);
      const message = error instanceof Error ? error.message : "Multi-send failed. Please try again.";
      Toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass space-y-6 rounded-lg border border-hairline bg-[color:var(--background)] p-6">
      <CardContent className="space-y-6 p-0">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Multi-Send</h2>
          <p className="text-sm text-muted">
            Send the same token to up to five recipients in a single flow.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(handleMultiSend)} className="space-y-6">
            <FormField
              control={control}
              name="token"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-foreground">Token</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (formState.isSubmitted) {
                          void trigger("recipients");
                        }
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full bg-surface-strong">
                        <SelectValue placeholder="Select a token" />
                      </SelectTrigger>
                      <SelectContent>
                        {tokenOptions.map((token) => (
                          <SelectItem key={token.value} value={token.value}>
                            <div className="flex items-center gap-3">
                              {token.iconUrl ? (
                                <img
                                  src={token.iconUrl}
                                  alt={token.label}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : token.fallbackIcon ? (
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                                  style={{
                                    backgroundColor: token.fallbackIcon.bgColor ?? "rgba(255,255,255,0.08)",
                                    color: token.fallbackIcon.textColor ?? "var(--foreground)",
                                  }}
                                >
                                  {token.fallbackIcon.letter ?? token.label[0]}
                                </span>
                              ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-foreground">
                                  {token.label[0]}
                                </span>
                              )}
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-medium text-foreground">{token.label}</span>
                                <span className="text-xs text-muted">{token.formattedAmount}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              {fieldArray.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-hairline bg-surface px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-4">
                      <FormField
                        control={control}
                        name={`recipients.${index}.address`}
                        render={({ field: addressField }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium text-foreground">
                              Recipient {index + 1}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter Keeta address"
                                className="bg-surface-strong text-sm text-foreground placeholder:text-foreground/60"
                                {...addressField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`recipients.${index}.amount`}
                        render={({ field: amountField }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-medium text-foreground">Amount</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter amount"
                                className="bg-surface-strong text-sm text-foreground placeholder:text-foreground/60"
                                {...amountField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-1 h-9 w-9 text-muted hover:text-destructive"
                      onClick={() => removeRecipient(index)}
                      disabled={fieldArray.fields.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={addRecipient}
                disabled={fieldArray.fields.length >= 5}
              >
                Add recipient ({fieldArray.fields.length}/5)
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full bg-accent text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-70"
              disabled={isSubmitting || !tokenOptions.length}
            >
              {isSubmitting ? "Processing..." : "Send to recipients"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default MultiSendForm;
