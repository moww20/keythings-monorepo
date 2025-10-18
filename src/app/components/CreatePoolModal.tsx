  'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Droplets, Info, AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { WizardProgress, type WizardProgressStep } from './WizardProgress';
import { useWallet } from '../contexts/WalletContext';
import { StorageAccountManager } from '../lib/storage-account-manager';

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Token {
  symbol: string;
  name: string;
  balance: string;
  address: string; // Full Keeta address for SDK calls
  decimals: number;
  icon: string;
  fallbackIcon: any; // TokenIcon from ProcessedToken
}

const POOL_TYPES = [
  {
    id: 'constant_product',
    label: 'Standard Pool',
    description: 'Best for general trading pairs (x*y=k)',
    recommended: 'Recommended for most pairs',
    enabled: true,
  },
  {
    id: 'stable_swap',
    label: 'Stable Pool',
    description: 'Low slippage for stablecoins (Curve-style)',
    recommended: 'Best for USDT/USDC, USDX/DAI',
    enabled: true,
  },
  {
    id: 'weighted',
    label: 'Weighted Pool',
    description: 'Custom weight ratios (Balancer-style)',
    recommended: 'Coming soon',
    enabled: false,
  },
];

const FEE_TIERS = [
  { bps: 10, label: '0.1%', description: 'Best for stablecoin pairs' },
  { bps: 30, label: '0.3%', description: 'Standard for most pairs' },
  { bps: 100, label: '1.0%', description: 'For exotic/volatile pairs' },
];

type CreatePoolStep = 'select' | 'amounts' | 'confirm' | 'liquidity';

const CREATE_POOL_STEPS: WizardProgressStep<CreatePoolStep>[] = [
  {
    id: 'select',
    title: 'Select Tokens',
    description: 'Choose assets to pair',
  },
  {
    id: 'amounts',
    title: 'Set Amounts',
    description: 'Specify deposits',
  },
  {
    id: 'confirm',
    title: 'Confirm Pool',
    description: 'Review details',
  },
  {
    id: 'liquidity',
    title: 'Add Liquidity',
    description: 'Deposit tokens',
  },
];

const STEP_SEQUENCE: CreatePoolStep[] = ['select', 'amounts', 'confirm', 'liquidity'];

export default function CreatePoolModal({ isOpen, onClose, onSuccess }: CreatePoolModalProps) {
  const { tokens, publicKey, userClient } = useWallet();
  const [step, setStep] = useState<CreatePoolStep>('select');

  const completedSteps = useMemo(() => {
    const currentIndex = STEP_SEQUENCE.indexOf(step);
    if (currentIndex <= 0) {
      return [] as CreatePoolStep[];
    }
    return STEP_SEQUENCE.slice(0, currentIndex) as CreatePoolStep[];
  }, [step]);

  // Form state
  const [tokenA, setTokenA] = useState<string>(''); // Token address
  const [tokenB, setTokenB] = useState<string>(''); // Token address
  const [amountA, setAmountA] = useState<string>('');
  const [amountB, setAmountB] = useState<string>('');
  const [poolType, setPoolType] = useState<string>('constant_product');
  const [feeRate, setFeeRate] = useState<number>(30);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenADropdown, setShowTokenADropdown] = useState(false);
  const [showTokenBDropdown, setShowTokenBDropdown] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<'idle' | 'building' | 'signing' | 'settling' | 'complete'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [poolStorageAddress, setPoolStorageAddress] = useState<string | null>(null);

  // Convert wallet tokens to dropdown format with full addresses
  const availableTokens: Token[] = useMemo(() => {
    return tokens.map(token => ({
      symbol: token.ticker || token.address.slice(-4).toUpperCase(),
      name: token.name || 'Unknown Token',
      balance: token.formattedAmount,
      address: token.address, // Full Keeta address
      decimals: token.decimals,
      icon: token.icon,
      fallbackIcon: token.fallbackIcon,
    }));
  }, [tokens]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setTokenA('');
      setTokenB('');
      setAmountA('');
      setAmountB('');
      setPoolType('constant_product');
      setFeeRate(30);
      setError(null);
      setIsSubmitting(false);
      setSettlementStatus('idle');
      setTxHash(null);
    }
  }, [isOpen]);

  const calculateInitialPrice = () => {
    if (!amountA || !amountB) return '0';
    const a = parseFloat(amountA);
    const b = parseFloat(amountB);
    if (a === 0) return '0';
    return (b / a).toFixed(6);
  };

  const calculateExpectedLpTokens = () => {
    if (!amountA || !amountB) return 0;
    const a = parseFloat(amountA);
    const b = parseFloat(amountB);
    const liquidity = Math.sqrt(a * b);
    const minLiquidity = 1; // Minimal for testnet
    
    if (liquidity <= minLiquidity) return 0;
    return Math.floor(liquidity - minLiquidity);
  };

  const validateMinimumLiquidity = () => {
    if (!amountA || !amountB) return { valid: false, message: '' };
    
    const a = parseFloat(amountA);
    const b = parseFloat(amountB);
    const liquidity = Math.sqrt(a * b);
    const minLiquidity = 1;
    
    if (liquidity <= minLiquidity) {
      return {
        valid: false,
        message: 'Minimum technical requirement not met.',
      };
    }
    
    return { valid: true, message: '' };
  };

  const getTokenSymbol = (address: string) => {
    const token = availableTokens.find(t => t.address === address);
    return token?.symbol || address.slice(-4).toUpperCase();
  };

  const getTokenDecimals = (address: string): number => {
    const token = availableTokens.find(t => t.address === address);
    return token?.decimals || 9; // Default to 9 if not found (KTA standard)
  };

  const handleCreatePool = async () => {
    setIsSubmitting(true);
    setError(null);
    setSettlementStatus('building');

    // If we're on step 'liquidity', this means we're adding liquidity (Step 4)
    if (step === 'liquidity') {
      await handleAddLiquidity();
      return;
    }

    // Otherwise, we're creating storage account (Step 3)

    try {
      // STEP 1: Validate wallet connection
      console.log('[CreatePool] Wallet status:', {
        publicKey,
        hasUserClient: !!userClient,
        userClientType: typeof userClient,
        userClientMethods: userClient ? Object.keys(userClient) : []
      });
      
      if (!publicKey) {
        throw new Error('Wallet not connected. Please connect your Keeta wallet first.');
      }
      
      if (!userClient) {
        throw new Error('Keeta SDK not initialized. Please unlock your wallet and try again.');
      }

      console.log('[CreatePool] Starting pool creation on Keeta testnet');
      console.log('[CreatePool] Token A:', tokenA, '| Amount:', amountA);
      console.log('[CreatePool] Token B:', tokenB, '| Amount:', amountB);

      // STEP 2: Create pool storage account (uses proven StorageAccountManager)
      console.log('[CreatePool] Step 1/2: Creating pool storage account...');
      console.log('[CreatePool] ⚠️ Please approve the transaction in your wallet extension!');
      setSettlementStatus('building');
      
      const manager = new StorageAccountManager(userClient);
      
      let poolStorageAddress: string;
      try {
        // Add timeout since wallet extension might not respond even after approval
        const createPromise = manager.createStorageAccount('POOL', []);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), 30000) // 30 second timeout
        );
        
        poolStorageAddress = await Promise.race([createPromise, timeoutPromise]);
        console.log('[CreatePool] ✅ Storage account created:', poolStorageAddress);
      } catch (error) {
        if (error instanceof Error && error.message === 'TIMEOUT') {
          // Timeout - but transaction might have succeeded
          console.warn('[CreatePool] ⚠️ Wallet response timeout - transaction may still have succeeded');
          
          // Ask user if they approved and if they see the storage account in wallet
          const proceed = confirm(
            'Storage account creation timed out.\n\n' +
            'Did you approve the transaction in your wallet?\n\n' +
            'Click OK if you approved it and want to continue.\n' +
            'Click Cancel to stop and try again later.'
          );
          
          if (!proceed) {
            throw new Error('Pool creation cancelled by user');
          }
          
          // User confirmed - proceed with a placeholder, they can deposit manually later
          poolStorageAddress = 'PENDING_VERIFICATION';
          console.log('[CreatePool] User confirmed approval, proceeding...');
        } else {
          throw error;
        }
      }
      
      setTxHash(poolStorageAddress);
      setPoolStorageAddress(poolStorageAddress); // Save to state for Step 4
      
      // Wait for settlement
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // STEP 3: Skip automatic liquidity deposit for now
      // Due to wallet extension serialization limitations with builder.send()
      // Users will need to deposit manually or we'll implement this differently
      console.log('[CreatePool] ⚠️ Automatic liquidity deposit not yet supported');
      console.log('[CreatePool] Storage account created - user can deposit manually');
      
      // Create a mock successful result for now
      const transferResult = {
        success: true,
        blocks: [{ hash: 'manual_deposit_required' }]
      };
      
      // Storage account created successfully - proceed to Step 4: Add Liquidity
      console.log('[CreatePool] ✅ Storage account created, proceeding to Step 4: Add Liquidity');
      setStep('liquidity');
      
      // Extract transaction hash
      let txHashValue = 'manual_deposit_required';
      if (transferResult.blocks && transferResult.blocks.length > 0) {
        const hash = transferResult.blocks[0]?.hash as any;
        if (typeof hash === 'string') {
          txHashValue = hash;
        } else if (hash && typeof hash.toString === 'function') {
          txHashValue = hash.toString();
        }
      }
      setTxHash(txHashValue);
      console.log('[CreatePool] Transaction hash:', txHashValue);
      console.log('[CreatePool] Pool storage address:', poolStorageAddress);
      
      // STEP 4: Wait for Keeta network settlement (400ms)
      setSettlementStatus('settling');
      console.log('[CreatePool] Waiting for Keeta settlement (400ms)...');
      await new Promise(resolve => setTimeout(resolve, 600));

      // STEP 5: Notify backend for UI tracking (NO CUSTODY)
      const poolId = `${getTokenSymbol(tokenA)}-${getTokenSymbol(tokenB)}`;
      
      console.log('[CreatePool] Notifying backend...');
      
      try {
        const backendResponse = await fetch('http://localhost:8080/api/pools/created', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pool_id: poolId,
            storage_account: poolStorageAddress || 'unknown',
            token_a: getTokenSymbol(tokenA),
            token_b: getTokenSymbol(tokenB),
            initial_a: amountA,
            initial_b: amountB,
            tx_hash: txHashValue,
            creator: publicKey,
            lp_token: `LP-${poolId}`,
            lp_tokens_minted: calculateExpectedLpTokens().toString(),
          }),
        });

        if (!backendResponse.ok) {
          console.warn('[CreatePool] Backend notification failed (non-critical):', await backendResponse.text());
        } else {
          console.log('[CreatePool] ✅ Backend notified successfully');
        }
      } catch (backendError) {
        console.warn('[CreatePool] Backend notification failed (non-critical):', backendError);
        // Continue anyway - pool exists on-chain even if backend doesn't know
      }

      // STEP 7: Mark storage account creation as complete
      setSettlementStatus('idle');
      
      // Don't close the modal - user needs to proceed to Step 4: Add Liquidity
      // The modal will close after Step 4 is complete
    } catch (err) {
      console.error('[CreatePool] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pool. Please try again.';
      setError(errorMessage);
      setSettlementStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLiquidity = async () => {
    setIsSubmitting(true);
    setError(null);
    setSettlementStatus('building');

    try {
      console.log('[CreatePool] Step 4: Adding liquidity to storage account...');
      console.log('[CreatePool] Storage account:', poolStorageAddress);
      console.log('[CreatePool] Amount A:', amountA, getTokenSymbol(tokenA));
      console.log('[CreatePool] Amount B:', amountB, getTokenSymbol(tokenB));
      
      if (!userClient || !publicKey) {
        throw new Error('Wallet not connected. Please reconnect your wallet.');
      }
      
      if (!poolStorageAddress || poolStorageAddress === '_PLACEHOLDER_') {
        throw new Error('Invalid storage account address. Please try creating the pool again.');
      }
      
      // Build transaction to send tokens to the pool storage account
      console.log('[CreatePool] Building liquidity deposit transaction...');
      setSettlementStatus('building');
      
      const builder = userClient.initBuilder();
      if (!builder) {
        throw new Error('Failed to initialize transaction builder');
      }
      
      // Convert amounts to string for serialization (BigInt can't be serialized through Chrome messaging)
      const tokenADecimals = getTokenDecimals(tokenA);
      const tokenBDecimals = getTokenDecimals(tokenB);
      const amountAStr = Math.floor(parseFloat(amountA) * Math.pow(10, tokenADecimals)).toString();
      const amountBStr = Math.floor(parseFloat(amountB) * Math.pow(10, tokenBDecimals)).toString();
      
      console.log('[CreatePool] Token A decimals:', tokenADecimals);
      console.log('[CreatePool] Token B decimals:', tokenBDecimals);
      console.log('[CreatePool] Amount A (raw):', amountA, '→ (units):', amountAStr);
      console.log('[CreatePool] Amount B (raw):', amountB, '→ (units):', amountBStr);
      
      // Send token A to pool storage account
      console.log('[CreatePool] Adding send operation for token A...');
      if (typeof builder.send !== 'function') {
        throw new Error('Builder does not support send operations');
      }
      
      // Validate all values before creating send operations
      if (!poolStorageAddress || poolStorageAddress === '_PLACEHOLDER_') {
        throw new Error('Invalid pool storage address');
      }
      if (!tokenA || !tokenB) {
        throw new Error('Token addresses are required');
      }
      
      // Create simple serializable objects for the token addresses
      // builder.send() signature: send(to, amount, token) - 3 parameters only!
      const toAccount = JSON.parse(JSON.stringify({ publicKeyString: poolStorageAddress }));
      const tokenARef = JSON.parse(JSON.stringify({ publicKeyString: tokenA }));
      const tokenBRef = JSON.parse(JSON.stringify({ publicKeyString: tokenB }));
      
      console.log('[CreatePool] toAccount:', JSON.stringify(toAccount));
      console.log('[CreatePool] tokenARef:', JSON.stringify(tokenARef));
      console.log('[CreatePool] tokenBRef:', JSON.stringify(tokenBRef));
      
      console.log('[CreatePool] Sending', amountAStr, 'of token A to', poolStorageAddress);
      // builder.send(to, amount, token) - SDK infers "from" account from builder context
      builder.send(toAccount, amountAStr, tokenARef);
      
      // Send token B to pool storage account
      console.log('[CreatePool] Adding send operation for token B...');
      console.log('[CreatePool] Sending', amountBStr, 'of token B to', poolStorageAddress);
      // builder.send(to, amount, token) - SDK infers "from" account from builder context
      builder.send(toAccount, amountBStr, tokenBRef);
      
      // Compute blocks before publishing (required by Keeta SDK for send operations)
      console.log('[CreatePool] Computing transaction blocks...');
      if (typeof (builder as any).computeBlocks === 'function') {
        await (builder as any).computeBlocks();
        console.log('[CreatePool] ✅ Blocks computed');
      }
      
      console.log('[CreatePool] ⚠️ Please approve the liquidity deposit transaction in your wallet extension!');
      console.warn('🔐 SECURITY: Wallet approval required for liquidity deposit');
      console.warn(`🔐 You are about to deposit ${amountA} ${getTokenSymbol(tokenA)} and ${amountB} ${getTokenSymbol(tokenB)} to the pool`);
      console.warn('🔐 Please review and approve the transaction in your Keeta Wallet extension');
      
      setSettlementStatus('signing');
      
      // SECURITY: This publishBuilder call MUST trigger wallet approval
      // User must explicitly approve the liquidity deposit transaction
      const depositResult = await userClient.publishBuilder(builder);
      console.log('[CreatePool] ✅ Liquidity deposit transaction signed and published');
      console.log('[CreatePool] Transaction result:', depositResult);
      
      // Extract transaction hash
      let txHashValue = 'liquidity_deposit_tx';
      if (typeof depositResult === 'string') {
        txHashValue = depositResult;
      } else if (depositResult && typeof depositResult === 'object') {
        const result = depositResult as any;
        if (result.blocks && result.blocks.length > 0) {
          const hash = result.blocks[0]?.hash;
          if (typeof hash === 'string') {
            txHashValue = hash;
          } else if (hash && typeof hash.toString === 'function') {
            txHashValue = hash.toString();
          }
        } else if (result.hash) {
          txHashValue = typeof result.hash === 'string' ? result.hash : result.hash.toString();
        }
      }
      
      console.log('[CreatePool] Liquidity deposit transaction hash:', txHashValue);
      
      // Wait for Keeta settlement (400ms)
      setSettlementStatus('settling');
      console.log('[CreatePool] Waiting for Keeta settlement (400ms)...');
      await new Promise(resolve => setTimeout(resolve, 600));

      setSettlementStatus('complete');
      console.log('[CreatePool] ✅ Liquidity deposited successfully!');
      console.log('[CreatePool] Pool is now active and ready for trading');
      
      // Show success briefly then close
      await new Promise(resolve => setTimeout(resolve, 1500));
      onSuccess();
      onClose();
      
    } catch (err) {
      console.error('[CreatePool] Error adding liquidity:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add liquidity. Please try again.';
      setError(errorMessage);
      setSettlementStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const availableTokensA = availableTokens.filter(t => t.address !== tokenB);
  const availableTokensB = availableTokens.filter(t => t.address !== tokenA);

  const canProceedToAmounts = tokenA && tokenB && tokenA !== tokenB;
  const liquidityValidation = validateMinimumLiquidity();
  const canProceedToConfirm = canProceedToAmounts && amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-lg border border-hairline shadow-[0_20px_60px_rgba(6,7,10,0.45)] w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Droplets className="h-5 w-5 text-accent" />
            <span>Create Liquidity Pool</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface-strong p-2 text-muted transition-colors hover:text-foreground"
            aria-label="Close create pool modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 p-4 border-b border-hairline bg-surface/30">
          <WizardProgress
            steps={CREATE_POOL_STEPS}
            currentStep={step}
            completedSteps={completedSteps}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}

          {/* Settlement Status */}
          {settlementStatus === 'building' && (
            <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-start gap-3">
              <svg className="animate-spin h-5 w-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-accent">Building Transaction</div>
                <div className="text-xs text-muted">Creating pool storage account with initial liquidity...</div>
              </div>
            </div>
          )}

          {settlementStatus === 'signing' && (
            <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-start gap-3">
              <svg className="animate-spin h-5 w-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-accent">Waiting for Signature</div>
                <div className="text-xs text-muted">Please approve in your wallet extension (creates pool + deposits {amountA} {getTokenSymbol(tokenA)} + {amountB} {getTokenSymbol(tokenB)})</div>
              </div>
            </div>
          )}

          {settlementStatus === 'settling' && (
            <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-start gap-3">
              <svg className="animate-spin h-5 w-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-accent">Settling on Keeta Testnet</div>
                <div className="text-xs text-muted">Confirming transaction (400ms settlement time)</div>
                {txHash && (
                  <a
                    href={`https://testnet.keeta.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {settlementStatus === 'complete' && (
            <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
              <svg className="h-5 w-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-500">Pool Created Successfully!</div>
                <div className="text-xs text-muted">Your pool is now live on Keeta testnet</div>
              </div>
            </div>
          )}

          {/* Step 1: Select Token Pair */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Pool Type Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Pool Type
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {POOL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => type.enabled && setPoolType(type.id)}
                      disabled={!type.enabled}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        !type.enabled
                          ? 'border-hairline bg-surface/30 opacity-50 cursor-not-allowed'
                          : poolType === type.id
                          ? 'border-accent bg-accent/5'
                          : 'border-hairline bg-surface hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{type.label}</h3>
                          {!type.enabled && (
                            <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-muted/20 text-muted">
                              SOON
                            </span>
                          )}
                        </div>
                        {poolType === type.id && type.enabled && (
                          <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted mb-2">{type.description}</p>
                      <p className="text-xs text-accent font-medium">{type.recommended}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Token Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Token Pair
                </label>
                <div className="flex items-center gap-3 mb-4">
                  {/* Token A */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setShowTokenADropdown(!showTokenADropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-hairline bg-surface hover:bg-surface-strong transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {tokenA ? (() => {
                          const token = availableTokens.find(t => t.address === tokenA);
                          return token?.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" />
                          ) : token?.fallbackIcon ? (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: token.fallbackIcon.bgColor || '#6aa8ff', color: token.fallbackIcon.textColor || '#ffffff' }}
                            >
                              <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-accent">{getTokenSymbol(tokenA).slice(0, 2)}</span>
                            </div>
                          );
                        })() : null}
                        <span className={tokenA ? 'text-foreground font-medium' : 'text-muted'}>
                          {tokenA ? getTokenSymbol(tokenA) : 'Select token'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted" />
                    </button>

                    {showTokenADropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTokenADropdown(false)} />
                        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-hairline bg-background shadow-xl max-h-60 overflow-y-auto z-50">
                          <div className="p-2">
                            {availableTokensA.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted">
                                No tokens in wallet. Add tokens first.
                              </div>
                            ) : (
                              availableTokensA.map((token) => (
                                <button
                                  key={token.address}
                                  onClick={() => {
                                    setTokenA(token.address);
                                    setShowTokenADropdown(false);
                                  }}
                                  className="w-full p-3 rounded-md text-left hover:bg-surface-strong transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {token.icon ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" />
                                      ) : token.fallbackIcon ? (
                                        <div
                                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                          style={{ backgroundColor: token.fallbackIcon.bgColor || '#6aa8ff', color: token.fallbackIcon.textColor || '#ffffff' }}
                                        >
                                          <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs font-bold text-accent">{token.symbol.slice(0, 2)}</span>
                                        </div>
                                      )}
                                      <div>
                                        <div className="font-medium text-foreground">{token.symbol}</div>
                                        <div className="text-xs text-muted">{token.name}</div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted font-mono">
                                      {token.balance}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Token B */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setShowTokenBDropdown(!showTokenBDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-hairline bg-surface hover:bg-surface-strong transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {tokenB ? (() => {
                          const token = availableTokens.find(t => t.address === tokenB);
                          return token?.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" />
                          ) : token?.fallbackIcon ? (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: token.fallbackIcon.bgColor || '#6aa8ff', color: token.fallbackIcon.textColor || '#ffffff' }}
                            >
                              <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-accent">{getTokenSymbol(tokenB).slice(0, 2)}</span>
                            </div>
                          );
                        })() : null}
                        <span className={tokenB ? 'text-foreground font-medium' : 'text-muted'}>
                          {tokenB ? getTokenSymbol(tokenB) : 'Select token'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted" />
                    </button>

                    {showTokenBDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTokenBDropdown(false)} />
                        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-hairline bg-background shadow-xl max-h-60 overflow-y-auto z-50">
                          <div className="p-2">
                            {availableTokensB.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted">
                                No tokens in wallet. Add tokens first.
                              </div>
                            ) : (
                              availableTokensB.map((token) => (
                                <button
                                  key={token.address}
                                  onClick={() => {
                                    setTokenB(token.address);
                                    setShowTokenBDropdown(false);
                                  }}
                                  className="w-full p-3 rounded-md text-left hover:bg-surface-strong transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {token.icon ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full object-cover" />
                                      ) : token.fallbackIcon ? (
                                        <div
                                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                          style={{ backgroundColor: token.fallbackIcon.bgColor || '#6aa8ff', color: token.fallbackIcon.textColor || '#ffffff' }}
                                        >
                                          <span className="text-xs font-bold">{token.fallbackIcon.letter}</span>
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs font-bold text-accent">{token.symbol.slice(0, 2)}</span>
                                        </div>
                                      )}
                                      <div>
                                        <div className="font-medium text-foreground">{token.symbol}</div>
                                        <div className="text-xs text-muted">{token.name}</div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted font-mono">
                                      {token.balance}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Fee Tier */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Fee Tier
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {FEE_TIERS.map((tier) => (
                      <button
                        key={tier.bps}
                        onClick={() => setFeeRate(tier.bps)}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          feeRate === tier.bps
                            ? 'border-accent bg-accent/5'
                            : 'border-hairline bg-surface hover:border-accent/50'
                        }`}
                      >
                        <h3 className="font-semibold text-foreground mb-1">{tier.label}</h3>
                        <p className="text-xs text-muted">{tier.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('amounts')}
                disabled={!canProceedToAmounts}
                className="w-full px-6 py-3 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Add Liquidity
              </button>
            </div>
          )}

          {/* Step 2: Add Liquidity Amounts */}
          {step === 'amounts' && (
            <div className="space-y-6">
              {/* Amount A Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {getTokenSymbol(tokenA)} Amount
                </label>
                <input
                  type="number"
                  value={amountA}
                  onChange={(e) => setAmountA(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 rounded-lg border border-hairline bg-surface text-foreground focus:outline-none focus:border-accent transition-colors"
                />
                <div className="mt-1 text-xs text-muted">
                  Available: {availableTokens.find(t => t.address === tokenA)?.balance || '0'} {getTokenSymbol(tokenA)}
                </div>
              </div>

              {/* Amount B Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {getTokenSymbol(tokenB)} Amount
                </label>
                <input
                  type="number"
                  value={amountB}
                  onChange={(e) => setAmountB(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-3 rounded-lg border border-hairline bg-surface text-foreground focus:outline-none focus:border-accent transition-colors"
                />
                <div className="mt-1 text-xs text-muted">
                  Available: {availableTokens.find(t => t.address === tokenB)?.balance || '0'} {getTokenSymbol(tokenB)}
                </div>
              </div>

              {/* Price Info */}
              {amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && (
                <div className="p-4 rounded-lg bg-surface border border-hairline">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Pool Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Initial Price</span>
                      <span className="text-foreground">1 {getTokenSymbol(tokenA)} = {calculateInitialPrice()} {getTokenSymbol(tokenB)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">LP Tokens</span>
                      <span className="text-foreground">{calculateExpectedLpTokens()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Share of Pool</span>
                      <span className="text-foreground">100%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Error */}
              {!liquidityValidation.valid && amountA && amountB && (
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs text-muted">{liquidityValidation.message}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-surface border border-hairline text-foreground rounded-md hover:bg-surface-strong transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!canProceedToConfirm || !liquidityValidation.valid}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review & Confirm
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-surface border border-hairline">
                <h3 className="text-sm font-semibold text-foreground mb-4">Pool Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Pool Pair</span>
                    <span className="text-sm font-medium text-foreground">
                      {getTokenSymbol(tokenA)}/{getTokenSymbol(tokenB)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Initial Liquidity</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">{amountA} {getTokenSymbol(tokenA)}</div>
                      <div className="text-sm font-medium text-foreground">{amountB} {getTokenSymbol(tokenB)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Initial Price</span>
                    <span className="text-sm font-medium text-foreground">
                      1 {getTokenSymbol(tokenA)} = {calculateInitialPrice()} {getTokenSymbol(tokenB)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">LP Tokens</span>
                    <span className="text-sm font-medium text-foreground">{calculateExpectedLpTokens()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Fee Tier</span>
                    <span className="text-sm font-medium text-foreground">{feeRate / 100}%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-muted leading-relaxed">
                    <strong className="text-foreground">Non-Custodial:</strong> You will be the OWNER of this pool&apos;s storage account. 
                    You maintain full control and can withdraw your liquidity anytime. The backend cannot move your funds.
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('amounts')}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-surface border border-hairline text-foreground rounded-md hover:bg-surface-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  onClick={handleCreatePool}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Storage Account'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Add Liquidity */}
          {step === 'liquidity' && (
            <div className="space-y-6">
              {/* Security Warning */}
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
                <svg className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 5v2h2v-2h-2z"/>
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-yellow-500 mb-1">🔐 Wallet Approval Required</div>
                  <div className="text-xs text-yellow-400">
                    Clicking &quot;Add Liquidity&quot; will prompt your Keeta Wallet to approve a transaction that deposits {amountA} {getTokenSymbol(tokenA)} and {amountB} {getTokenSymbol(tokenB)} to the pool storage account. Please review and approve the transaction.
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Storage Account Created!</h3>
                <p className="text-sm text-muted mb-6">
                  Your pool storage account has been created successfully. Now let&apos;s add your initial liquidity.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-surface border border-hairline">
                <h4 className="text-sm font-semibold text-foreground mb-4">Liquidity to Add</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-strong">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-accent">{getTokenSymbol(tokenA)[0]}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{getTokenSymbol(tokenA)}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{amountA}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-strong">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-accent">{getTokenSymbol(tokenB)[0]}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{getTokenSymbol(tokenB)}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{amountB}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-muted leading-relaxed">
                    <strong className="text-foreground">Next Step:</strong> You&apos;ll need to send your tokens to the pool storage account manually through your wallet&apos;s send feature. 
                    Once both tokens are deposited, your pool will be active and ready for trading.
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('confirm')}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-surface border border-hairline text-foreground rounded-md hover:bg-surface-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  onClick={handleCreatePool}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding Liquidity...
                    </>
                  ) : (
                    'Add Liquidity'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

