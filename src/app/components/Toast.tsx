"use client";

import { useEffect, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";

export interface ToastOptions {
  duration?: number;
}

type ToastType = "success" | "error" | "warning" | "info";

interface ToastEventDetail {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

const TOAST_EVENT = "keythings-toast";
const toastEmitter = typeof window !== "undefined" ? new EventTarget() : null;

function emitToast(type: ToastType, message: string, options?: ToastOptions) {
  const detail: ToastEventDetail = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    type,
    message,
    duration: options?.duration,
  };

  if (toastEmitter) {
    toastEmitter.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
  } else {
    console.log(`[Toast:${type}] ${message}`);
  }
}

export const ToastBridge = (): React.ReactElement | null => {
  const [toasts, setToasts] = useState<ToastEventDetail[]>([]);

  useEffect(() => {
    if (!toastEmitter) {
      return undefined;
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      setToasts((previous) => [...previous, customEvent.detail]);
    };

    toastEmitter.addEventListener(TOAST_EVENT, handler);
    return () => {
      toastEmitter.removeEventListener(TOAST_EVENT, handler);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      {toasts.map((toast) => (
        <ToastPrimitive.Root
          key={toast.id}
          duration={toast.duration ?? 4000}
          className="rounded-xl border border-soft bg-[color:color-mix(in_oklab,var(--foreground)_4%,transparent)] px-4 py-3 shadow-lg shadow-black/25 text-sm text-foreground/90"
          onOpenChange={(open) => {
            if (!open) {
              setToasts((previous) => previous.filter((item) => item.id !== toast.id));
            }
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-muted">{toast.type}</span>
            <span>{toast.message}</span>
          </div>
        </ToastPrimitive.Root>
      ))}
    </>
  );
};

const Toast = {
  success(message: string, options?: ToastOptions) {
    emitToast("success", message, options);
  },
  error(message: string, options?: ToastOptions) {
    emitToast("error", message, options);
  },
  warning(message: string, options?: ToastOptions) {
    emitToast("warning", message, options);
  },
  info(message: string, options?: ToastOptions) {
    emitToast("info", message, options);
  },
};

export default Toast;
