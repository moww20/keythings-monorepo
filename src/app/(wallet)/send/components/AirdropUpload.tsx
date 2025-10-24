'use client';

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import Toast from "@/app/components/Toast";
import { Inbox, Upload, XCircle } from "lucide-react";

import type { DragEvent, ChangeEvent } from "react";

const uploadSchema = z.object({
  token: z.string().min(1, "Select a token"),
  file: z.instanceof(File, { message: "Upload a CSV file" }),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

type ParsedRecipient = {
  address: string;
  amount: string;
};

const parseCsvContent = (content: string): ParsedRecipient[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [address, amount] = line.split(",");
      return {
        address: address?.trim() ?? "",
        amount: amount?.trim() ?? "",
      } satisfies ParsedRecipient;
    })
    .filter((entry) => entry.address && entry.amount);
};

const AirdropUpload = () => {
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
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ParsedRecipient[]>([]);

  const tokenOptions = useMemo(() => {
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
      };
    });
  }, [tokens]);

  const defaultToken = tokenOptions[0]?.value ?? "";

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      token: defaultToken,
      file: undefined,
    },
  });

  const { setValue, getValues, reset, formState, trigger, control } = form;

  const handleFileParse = useCallback(
    async (file: File) => {
      if (file.type !== "text/csv") {
        Toast.error("Only CSV files are supported. Format: address,amount per line.");
        return;
      }

      try {
        const textContent = await file.text();
        const parsedRecipients = parseCsvContent(textContent);

        if (!parsedRecipients.length) {
          Toast.error("No valid recipients found. Ensure CSV has address,amount per line.");
          return;
        }

        setValue("file", file, { shouldValidate: true });
        setRecipients(parsedRecipients);
        setFileName(file.name);
      } catch (error) {
        console.error("[AirdropUpload] Failed to parse file", error);
        Toast.error("Failed to parse CSV file. Please check formatting and try again.");
      }
    },
    [setValue],
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFileParse(file);
      }
    },
    [handleFileParse],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleFileParse(file);
      }
    },
    [handleFileParse],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const clearUpload = useCallback(() => {
    reset({
      token: getValues("token") || defaultToken,
      file: undefined,
    });
    setRecipients([]);
    setFileName(null);
  }, [defaultToken, getValues, reset]);

  const handleAirdrop = useCallback(async () => {
    const { token, file } = getValues();

    if (!file) {
      Toast.error("Upload a CSV file before sending.");
      return;
    }

    if (!recipients.length) {
      Toast.error("No recipients parsed from file.");
      return;
    }

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

    const tokenMetadata = tokenOptions.find((option) => option.value === token);

    if (!tokenMetadata) {
      Toast.error("Selected token metadata not available.");
      return;
    }

    setIsSubmitting(true);

    try {
      for (const entry of recipients) {
        const builder = userClient.initBuilder();
        if (!builder) {
          throw new Error("Failed to initialize transaction builder. Please update your Keeta Wallet.");
        }

        if (typeof builder.send !== "function") {
          throw new Error("Wallet does not support send operations. Please update your Keeta Wallet.");
        }

        const toAccount = JSON.parse(JSON.stringify({ publicKeyString: entry.address }));
        const tokenRef = JSON.parse(JSON.stringify({ publicKeyString: token }));

        const amountInBaseUnits = toBaseUnits(entry.amount, tokenMetadata.decimals).toString();

        builder.send(toAccount, amountInBaseUnits, tokenRef);

        if (typeof (builder as any).computeBlocks === "function") {
          await (builder as any).computeBlocks();
        }

        await userClient.publishBuilder(builder);
        Toast.success(`Sent ${entry.amount} ${tokenMetadata.label} to ${entry.address}`);
      }

      clearUpload();
    } catch (error) {
      console.error("[AirdropUpload] Transaction failed", error);
      const message = error instanceof Error ? error.message : "Airdrop failed. Please try again.";
      Toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearUpload,
    getValues,
    hasTransactionPermissions,
    isConnected,
    isDisconnected,
    isLocked,
    isUnlocked,
    recipients,
    requestTransactionPermissions,
    tokenOptions,
    userClient,
  ]);

  return (
    <Card className="glass space-y-6 rounded-lg border border-hairline bg-[color:var(--background)] p-6">
      <CardContent className="space-y-6 p-0">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Airdrop Tool</h2>
          <p className="text-sm text-muted">
            Upload a CSV with `address,amount` rows to distribute tokens in bulk.
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
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
                          void trigger("file");
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
                                <Image
                                  src={token.iconUrl}
                                  alt={token.label}
                                  width={24}
                                  height={24}
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

            <FormField
              control={control}
              name="file"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-foreground">Recipient list</FormLabel>
                  <FormControl>
                    <label
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-hairline bg-surface px-6 py-9 transition",
                        isDragging ? "border-accent text-accent" : "hover:border-accent/70",
                        fileName ? "text-foreground" : "text-muted",
                      )}
                    >
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileInput}
                      />
                      {fileName ? (
                        <>
                          <Inbox className="h-8 w-8" />
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-medium text-foreground">{fileName}</p>
                            <p className="text-xs text-muted">Parsed {recipients.length} recipients</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearUpload();
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Clear file
                          </Button>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8" />
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-medium text-foreground">
                              Drag & drop your CSV or click to upload
                            </p>
                            <p className="text-xs text-muted">Format: address,amount</p>
                          </div>
                        </>
                      )}
                    </label>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface px-4 py-4 text-sm text-muted">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                <span>Recipients preview</span>
                <span>{recipients.length} entries</span>
              </div>

              <div className="max-h-48 space-y-3 overflow-y-auto pr-1 text-xs">
                {recipients.length ? (
                  recipients.map((entry, index) => (
                    <div key={`${entry.address}-${index}`} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-foreground">{entry.address}</span>
                      <span className="text-foreground">{entry.amount}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted">Upload a CSV to preview recipients.</p>
                )}
              </div>
            </div>

            <Button
              type="button"
              className="w-full bg-accent text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-70"
              onClick={() => void handleAirdrop()}
              disabled={isSubmitting || !tokenOptions.length || !recipients.length}
            >
              {isSubmitting ? "Processing..." : "Execute airdrop"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AirdropUpload;
