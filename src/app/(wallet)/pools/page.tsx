'use client';

import { useState, useEffect, useCallback } from 'react';
import { Droplets, Plus, TrendingUp, DollarSign, Percent, ChevronDown, ChevronUp, ExternalLink, Info, AlertCircle, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import CreatePoolModal from '../../components/CreatePoolModal';
import AddLiquidityModal from '../../components/AddLiquidityModal';
import RemoveLiquidityModal from '../../components/RemoveLiquidityModal';

interface Pool {
  id: string;
  token_a: string;
  token_b: string;
  reserve_a: string;
  reserve_b: string;
  lp_token: string;
  total_lp_supply: string;
  fee_rate: string;
  pool_type: string;
  storage_account: string;
  tvl_usd?: string;
  volume_24h?: string;
  apy?: string;
}

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'myPools'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddLiquidityModalOpen, setIsAddLiquidityModalOpen] = useState(false);
  const [isRemoveLiquidityModalOpen, setIsRemoveLiquidityModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  // Fetch pools from backend
  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    async function doFetch() {
      try {
        const response = await fetch('http://localhost:8080/api/pools/list');
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        const data = await response.json();
        setPools(data.pools || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching pools:', err);
        setError('Backend not running');
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    }

    await doFetch();
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const handleCreateSuccess = () => {
    fetchPools(); // Refresh pool list
  };

  const handleAddLiquidity = (pool: Pool) => {
    setSelectedPool(pool);
    setIsAddLiquidityModalOpen(true);
  };

  const handleRemoveLiquidity = (pool: Pool) => {
    setSelectedPool(pool);
    setIsRemoveLiquidityModalOpen(true);
  };

  const togglePoolDetails = (poolId: string) => {
    setExpandedPoolId(expandedPoolId === poolId ? null : poolId);
  };

  const formatNumber = (value: string | number | undefined, decimals: number = 2): string => {
    if (!value) return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(decimals)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(decimals)}K`;
    }
    return num.toFixed(decimals);
  };

  const getPoolTypeLabel = (type: string): string => {
    switch (type) {
      case 'constant_product':
        return 'Standard';
      case 'stable_swap':
        return 'Stable';
      case 'weighted':
        return 'Weighted';
      default:
        return type;
    }
  };

  const getPoolTypeColor = (type: string): string => {
    switch (type) {
      case 'constant_product':
        return 'bg-accent/10 text-accent';
      case 'stable_swap':
        return 'bg-green-500/10 text-green-500';
      case 'weighted':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-surface text-muted';
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Droplets className="h-8 w-8 text-accent" />
            <h1 className="text-4xl font-bold text-foreground">Liquidity Pools</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-accent/20 text-accent">
              BETA
            </span>
          </div>
          <p className="text-base text-muted">
            Provide liquidity and earn fees from swaps
          </p>
        </div>
        
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent/90 transition-colors min-w-[140px]"
        >
          <Plus className="h-4 w-4" />
          Create Pool
        </button>
      </div>

      {/* Backend Error Banner */}
      {error && (
        <div className="glass rounded-lg border border-red-500/30 p-4 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Backend Not Running
              </h3>
              <p className="text-xs text-muted leading-relaxed mb-2">
                The backend server is not responding. Please start it to see pools data.
              </p>
              <div className="bg-surface/50 border border-hairline rounded p-2 font-mono text-xs">
                <div className="text-muted mb-1"># Start backend:</div>
                <div className="text-foreground">cd keythings-dapp-engine && cargo run</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="glass rounded-lg border border-hairline p-4 bg-accent/5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Liquidity Pools - Part of Our Hybrid Exchange
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Keeta CEX combines <strong>CLOB (Order Book)</strong> + <strong>AMM (Liquidity Pools)</strong> + <strong>Smart Router</strong> for best execution. 
              Add liquidity to pools and earn 0.24% of all swap fees automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-lg border border-hairline p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted" />
            <span className="text-sm text-muted">Total Value Locked</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            ${formatNumber(pools.reduce((sum, pool) => sum + parseFloat(pool.tvl_usd || '0'), 0), 0)}
          </div>
        </div>

        <div className="glass rounded-lg border border-hairline p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted" />
            <span className="text-sm text-muted">24h Volume</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            ${formatNumber(pools.reduce((sum, pool) => sum + parseFloat(pool.volume_24h || '0'), 0), 0)}
          </div>
        </div>

        <div className="glass rounded-lg border border-hairline p-4">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="h-4 w-4 text-muted" />
            <span className="text-sm text-muted">Active Pools</span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {pools.length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-hairline">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'all'
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          All Pools
        </button>
        <button
          onClick={() => setActiveTab('myPools')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'myPools'
              ? 'border-accent text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          My Pools
        </button>
      </div>

      {/* Pools List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm text-muted">Loading pools...</p>
            </div>
          </div>
        ) : pools.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="glass rounded-lg border border-hairline p-8 max-w-md text-center">
              <Droplets className="h-16 w-16 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Pools Yet</h3>
              <p className="text-sm text-muted mb-6">
                {error 
                  ? 'Start the backend server to see pools or create the first pool.'
                  : 'Be the first to create a liquidity pool and start earning fees!'
                }
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-accent text-white px-6 py-2.5 rounded-md font-medium hover:bg-accent/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create First Pool
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {pools.map((pool) => {
              const isExpanded = expandedPoolId === pool.id;
              const currentPrice = parseFloat(pool.reserve_b) / parseFloat(pool.reserve_a);
              
              return (
                <div
                  key={pool.id}
                  className="glass rounded-lg border border-hairline overflow-hidden transition-all duration-200"
                >
                  {/* Main Pool Card */}
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Pool Info */}
                      <div className="flex items-center gap-4">
                        {/* Token Icons */}
                        <div className="flex items-center -space-x-2">
                          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm border-2 border-[color:var(--background)]">
                            {pool.token_a.slice(0, 2)}
                          </div>
                          <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-semibold text-sm border-2 border-[color:var(--background)]">
                            {pool.token_b.slice(0, 2)}
                          </div>
                        </div>

                        {/* Pool Details */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              {pool.token_a}/{pool.token_b}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPoolTypeColor(pool.pool_type)}`}>
                              {getPoolTypeLabel(pool.pool_type)}
                            </span>
                            <span className="text-xs text-muted">
                              {parseFloat(pool.fee_rate) * 100}% fee
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted">
                            <span>
                              TVL: <span className="text-foreground font-medium">${formatNumber(pool.tvl_usd || (parseFloat(pool.reserve_a) + parseFloat(pool.reserve_b)).toString())}</span>
                            </span>
                            <span>•</span>
                            <span>
                              24h Vol: <span className="text-foreground font-medium">${formatNumber(pool.volume_24h || '0')}</span>
                            </span>
                            <span>•</span>
                            <span>
                              APY: <span className="text-green-500 font-medium">{pool.apy || '0'}%</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddLiquidity(pool)}
                          className="px-4 py-2 text-sm font-medium text-foreground bg-surface border border-hairline rounded-md hover:bg-surface-strong transition-colors inline-flex items-center gap-2"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Add
                        </button>
                        <button
                          onClick={() => togglePoolDetails(pool.id)}
                          className="px-4 py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-1"
                        >
                          Details
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-hairline bg-surface/30 p-6 space-y-4">
                      {/* Pool Statistics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-background border border-hairline">
                          <div className="text-xs text-muted mb-1">Pool Reserves</div>
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">
                              {parseFloat(pool.reserve_a).toLocaleString()} {pool.token_a}
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {parseFloat(pool.reserve_b).toLocaleString()} {pool.token_b}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-background border border-hairline">
                          <div className="text-xs text-muted mb-1">Current Price</div>
                          <div className="text-sm font-medium text-foreground">
                            1 {pool.token_a} = {currentPrice.toFixed(6)} {pool.token_b}
                          </div>
                          <div className="text-sm font-medium text-muted">
                            1 {pool.token_b} = {(1/currentPrice).toFixed(6)} {pool.token_a}
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-background border border-hairline">
                          <div className="text-xs text-muted mb-1">Total LP Supply</div>
                          <div className="text-sm font-medium text-foreground">
                            {parseFloat(pool.total_lp_supply).toLocaleString()}
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-background border border-hairline">
                          <div className="text-xs text-muted mb-1">Storage Account</div>
                          <div className="text-xs font-mono text-foreground">
                            {pool.storage_account}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleAddLiquidity(pool)}
                          className="flex-1 px-6 py-3 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Add Liquidity
                        </button>
                        <button
                          onClick={() => handleRemoveLiquidity(pool)}
                          className="flex-1 px-6 py-3 text-sm font-medium bg-surface border border-hairline text-foreground rounded-md hover:bg-surface-strong transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                          Remove Liquidity
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Modals */}
      <CreatePoolModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <AddLiquidityModal
        isOpen={isAddLiquidityModalOpen}
        onClose={() => setIsAddLiquidityModalOpen(false)}
        onSuccess={handleCreateSuccess}
        pool={selectedPool}
      />

      <RemoveLiquidityModal
        isOpen={isRemoveLiquidityModalOpen}
        onClose={() => setIsRemoveLiquidityModalOpen(false)}
        onSuccess={handleCreateSuccess}
        pool={selectedPool}
      />
    </div>
  );
}

