'use client';

import { Wallet } from 'lucide-react';

/**
 * UnifiedLoadingScreen - Shows a single, consistent loading state
 * while the wallet is initializing, connecting, or loading tokens
 */
export default function UnifiedLoadingScreen({ 
  message = "Loading your wallet...", 
  showWalletIcon = true 
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--background)] text-center p-6 animate-fade-in">
      <div className="glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] p-8 max-w-md animate-slide-up">
        {showWalletIcon && (
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Wallet className="h-16 w-16 text-accent animate-pulse" />
              <div className="absolute inset-0 animate-ping">
                <Wallet className="h-16 w-16 text-accent opacity-20" />
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-foreground animate-fade-in">
            {message}
          </h1>
          
          <div className="flex items-center justify-center gap-2">
            <div className="flex space-x-1">
              <div className="h-2 w-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-2 w-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-2 w-2 bg-accent rounded-full animate-bounce"></div>
            </div>
          </div>
          
          <p className="text-sm text-muted animate-fade-in">
            Please wait while we connect to your Keeta Wallet
          </p>
        </div>
      </div>
    </div>
  );
}
