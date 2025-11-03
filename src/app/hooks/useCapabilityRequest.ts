import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

const CapabilityEntrySchema = z.union([
  z.string(),
  z
    .object({
      capability: z.string(),
      granted: z.boolean().optional(),
      token: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
    })
    .passthrough(),
]);

const CapabilityEnvelopeSchema = z
  .object({
    capabilities: z.array(CapabilityEntrySchema).optional().nullable(),
  })
  .passthrough();

const CapabilityResponseSchema = z.union([
  CapabilityEntrySchema,
  z.array(CapabilityEntrySchema),
  CapabilityEnvelopeSchema,
]);

type CapabilityRequestFn = (capabilities: string[]) => Promise<unknown> | unknown;

type ProviderCapabilityMethods = {
  refreshCapabilities?: CapabilityRequestFn;
  requestCapabilities?: CapabilityRequestFn;
};

export interface CapabilityRequestOptions {
  capability: string;
  provider?: ProviderCapabilityMethods | null;
  autoRequest?: boolean;
}

export interface CapabilityRequestHook {
  granted: boolean;
  loading: boolean;
  error: string | null;
  request: () => Promise<boolean>;
  reset: () => void;
}

const DEFAULT_OPTIONS: CapabilityRequestOptions = {
  capability: "history",
  provider: undefined,
  autoRequest: true,
};

type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;

function extractCapabilities(value: unknown): string[] {
  const parsed = CapabilityResponseSchema.safeParse(value);
  if (!parsed.success) {
    return [];
  }

  const flatten = (entry: CapabilityEntry): string | null => {
    if (typeof entry === "string") {
      return entry;
    }

    if (typeof entry === "object" && entry) {
      if (typeof entry.capability === "string") {
        return entry.capability;
      }

      if (Array.isArray(entry.capabilities)) {
        const nested = entry.capabilities.find((cap) => typeof cap === "string" && cap.length > 0);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  };

  if (Array.isArray(parsed.data)) {
    return parsed.data.map(flatten).filter((cap): cap is string => typeof cap === "string" && cap.length > 0);
  }

  if (typeof parsed.data === "string") {
    return [parsed.data];
  }

  const envelope = CapabilityEnvelopeSchema.safeParse(parsed.data);
  if (!envelope.success || !envelope.data.capabilities) {
    return [];
  }

  return envelope.data.capabilities
    .map(flatten)
    .filter((cap): cap is string => typeof cap === "string" && cap.length > 0);
}

async function callCapabilityMethod(
  method: CapabilityRequestFn | undefined,
  capability: string,
): Promise<string[]> {
  if (typeof method !== "function") {
    return [];
  }

  try {
    const result = await method([capability]);
    return extractCapabilities(result);
  } catch {
    return [];
  }
}

export function useCapabilityRequest(options?: CapabilityRequestOptions): CapabilityRequestHook {
  const mergedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const { capability, autoRequest } = mergedOptions;

  const providerRef = useRef<ProviderCapabilityMethods | null | undefined>(mergedOptions.provider);
  providerRef.current = mergedOptions.provider;

  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(Boolean(autoRequest));
  const [error, setError] = useState<string | null>(null);

  const evaluateResponses = useCallback(
    (responses: string[][]): boolean =>
      responses.some((caps) => caps.some((cap) => cap.toLowerCase() === capability.toLowerCase())),
    [capability],
  );

  const requestCapability = useCallback(async (): Promise<boolean> => {
    const provider = providerRef.current;
    if (!provider) {
      setGranted(false);
      setError("Keeta provider not available");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const responses: string[][] = [];
      const refreshed = await callCapabilityMethod(provider.refreshCapabilities, capability);
      if (refreshed.length > 0) {
        responses.push(refreshed);
      }

      if (!responses.length) {
        const requested = await callCapabilityMethod(provider.requestCapabilities, capability);
        if (requested.length > 0) {
          responses.push(requested);
        }
      }

      const isGranted = responses.length === 0 ? true : evaluateResponses(responses);
      setGranted(isGranted);
      return isGranted;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to request capability";
      setError(message);
      setGranted(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [capability, evaluateResponses]);

  useEffect(() => {
    if (!autoRequest) {
      setLoading(false);
      return;
    }

    void requestCapability();
  }, [autoRequest, requestCapability]);

  const reset = useCallback(() => {
    setGranted(false);
    setError(null);
  }, []);

  return {
    granted,
    loading,
    error,
    request: requestCapability,
    reset,
  };
}
