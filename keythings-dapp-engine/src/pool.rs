use chrono;
use dashmap::DashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct LiquidityPool {
    pub id: String,
    pub token_a: String,
    pub token_b: String,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub total_lp_supply: u64,
    pub storage_account: String,
    pub lp_token: String,
    pub fee_rate: u64, // in basis points (30 = 0.3%)
    pub pool_type: PoolType,
    pub paused: bool,
    #[allow(dead_code)]
    pub protocol_fees_a: u64,
    #[allow(dead_code)]
    pub protocol_fees_b: u64,

    // Phase 2: On-chain state tracking
    pub on_chain_storage_account: String, // Real Keeta storage account address
    pub on_chain_reserve_a: u64,          // Last reconciled on-chain balance for token A
    pub on_chain_reserve_b: u64,          // Last reconciled on-chain balance for token B
    pub last_reconciled_at: Option<String>, // ISO 8601 timestamp of last reconciliation
    pub pending_settlement: bool,         // True if there are unconfirmed on-chain txs
    pub last_swap_signature: Option<String>, // Last confirmed swap tx signature
    pub last_swap_at: Option<String>,     // Timestamp of last confirmed swap
    pub last_swap_token_in: Option<String>, // Token sent into pool in last swap
    pub last_swap_token_out: Option<String>, // Token received from pool in last swap
    pub last_swap_amount_in: Option<u64>, // Amount in (raw units) for last swap
    pub last_swap_amount_out: Option<u64>, // Amount out (raw units) for last swap
}

#[derive(Debug, Clone)]
pub enum PoolType {
    ConstantProduct,
    StableSwap { amplification: u64 },
    Weighted { weight_a: u8, weight_b: u8 },
}

#[derive(Clone)]
pub struct PoolManager {
    pools: Arc<DashMap<String, LiquidityPool>>,
}

impl PoolManager {
    pub fn new() -> Self {
        Self {
            pools: Arc::new(DashMap::new()),
        }
    }

    pub fn create_pool(
        &self,
        token_a: String,
        token_b: String,
        initial_a: u64,
        initial_b: u64,
        fee_rate: u64,
        pool_type: PoolType,
    ) -> Result<String, PoolError> {
        let pool_id = format!("{}-{}", token_a, token_b);

        if self.pools.contains_key(&pool_id) {
            return Err(PoolError::PoolAlreadyExists);
        }

        // Bootstrap liquidity calculation
        let liquidity = self.calculate_initial_liquidity(initial_a, initial_b)?;

        let pool = LiquidityPool {
            id: pool_id.clone(),
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            reserve_a: initial_a,
            reserve_b: initial_b,
            total_lp_supply: liquidity,
            storage_account: format!("S_pool_{}_{}", token_a, token_b),
            lp_token: format!("LP-{}-{}", token_a, token_b),
            fee_rate,
            pool_type,
            paused: false,
            protocol_fees_a: 0,
            protocol_fees_b: 0,
            // Initialize on-chain tracking fields
            on_chain_storage_account: String::new(), // Will be set by pool_api when creating storage account
            on_chain_reserve_a: 0,
            on_chain_reserve_b: 0,
            last_reconciled_at: None,
            pending_settlement: false,
            last_swap_signature: None,
            last_swap_at: None,
            last_swap_token_in: None,
            last_swap_token_out: None,
            last_swap_amount_in: None,
            last_swap_amount_out: None,
        };

        self.pools.insert(pool_id.clone(), pool);
        Ok(pool_id)
    }

    pub fn get_pool(&self, pool_id: &str) -> Option<LiquidityPool> {
        self.pools.get(pool_id).map(|p| p.clone())
    }

    pub fn list_pools(&self) -> Vec<LiquidityPool> {
        self.pools
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    fn calculate_initial_liquidity(&self, amount_a: u64, amount_b: u64) -> Result<u64, PoolError> {
        const MINIMUM_LIQUIDITY: u64 = 1; // Minimal for demo/testing - increase to 1000 for production

        let liquidity = ((amount_a as u128 * amount_b as u128).integer_sqrt()) as u64;

        if liquidity <= MINIMUM_LIQUIDITY {
            return Err(PoolError::InsufficientLiquidity);
        }

        // Burn minimum liquidity to prevent inflation attacks
        Ok(liquidity - MINIMUM_LIQUIDITY)
    }

    // Phase 6: Security - Emergency pause functionality

    /// Update the on-chain storage account address for a pool
    /// Called after successfully creating storage account on Keeta
    pub fn update_storage_account(
        &self,
        pool_id: &str,
        storage_account: String,
    ) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;
        pool.on_chain_storage_account = storage_account;
        pool.pending_settlement = false;
        Ok(())
    }

    /// Pause a pool to prevent all operations (swaps, liquidity changes)
    /// Used in emergencies or when drift is detected
    #[allow(dead_code)]
    pub fn pause_pool(&self, pool_id: &str) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;
        pool.paused = true;
        log::warn!("Pool {} has been PAUSED", pool_id);
        Ok(())
    }

    /// Unpause a pool to resume normal operations
    /// Reserved for future pool management API
    #[allow(dead_code)]
    pub fn unpause_pool(&self, pool_id: &str) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;
        pool.paused = false;
        log::info!("Pool {} has been UNPAUSED", pool_id);
        Ok(())
    }

    /// Update on-chain reserve tracking for a pool
    /// Called when pool is created or after reconciliation
    pub fn update_on_chain_reserves(
        &self,
        pool_id: &str,
        reserve_a: u64,
        reserve_b: u64,
    ) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;
        pool.on_chain_reserve_a = reserve_a;
        pool.on_chain_reserve_b = reserve_b;
        pool.last_reconciled_at = Some(chrono::Utc::now().to_rfc3339());
        log::info!(
            "Pool {} on-chain reserves updated: {}/{}",
            pool_id,
            reserve_a,
            reserve_b
        );
        Ok(())
    }

    /// Update reconciliation status for a pool
    /// Called after reconciliation completes
    pub fn update_reconciliation(
        &self,
        pool_id: &str,
        on_chain_reserve_a: u64,
        on_chain_reserve_b: u64,
        timestamp: String,
    ) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;
        pool.on_chain_reserve_a = on_chain_reserve_a;
        pool.on_chain_reserve_b = on_chain_reserve_b;
        pool.last_reconciled_at = Some(timestamp);
        pool.pending_settlement = false;
        Ok(())
    }

    /// Record a confirmed swap without mutating reserves optimistically.
    /// The reconciler will refresh reserves using on-chain balances.
    pub fn record_swap_confirmation(
        &self,
        pool_id: &str,
        token_in: &str,
        token_out: &str,
        amount_in: u64,
        amount_out: u64,
        tx_signature: Option<String>,
        confirmed_at: Option<String>,
    ) -> Result<(), PoolError> {
        let mut pool = self.pools.get_mut(pool_id).ok_or(PoolError::PoolNotFound)?;

        pool.pending_settlement = true;
        pool.last_swap_signature = tx_signature;
        pool.last_swap_at = confirmed_at.or_else(|| Some(chrono::Utc::now().to_rfc3339()));
        pool.last_swap_token_in = Some(token_in.to_string());
        pool.last_swap_token_out = Some(token_out.to_string());
        pool.last_swap_amount_in = Some(amount_in);
        pool.last_swap_amount_out = Some(amount_out);

        Ok(())
    }
}

impl LiquidityPool {
    /// Calculate output amount for a swap (with fee)
    pub fn get_amount_out(&self, amount_in: u64, token_in: &str) -> Result<u64, PoolError> {
        if self.paused {
            return Err(PoolError::PoolPaused);
        }

        let (reserve_in, reserve_out) = if token_in == self.token_a {
            (self.reserve_a, self.reserve_b)
        } else if token_in == self.token_b {
            (self.reserve_b, self.reserve_a)
        } else {
            return Err(PoolError::InvalidToken);
        };

        match self.pool_type {
            PoolType::ConstantProduct => {
                self.constant_product_out(amount_in, reserve_in, reserve_out)
            }
            PoolType::StableSwap { amplification } => {
                self.stable_swap_out(amount_in, reserve_in, reserve_out, amplification)
            }
            PoolType::Weighted { weight_a, weight_b } => {
                let (weight_in, weight_out) = if token_in == self.token_a {
                    (weight_a, weight_b)
                } else {
                    (weight_b, weight_a)
                };
                self.weighted_pool_out(amount_in, reserve_in, reserve_out, weight_in, weight_out)
            }
        }
    }

    fn constant_product_out(
        &self,
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
    ) -> Result<u64, PoolError> {
        if amount_in == 0 {
            return Err(PoolError::InsufficientInputAmount);
        }
        if reserve_in == 0 || reserve_out == 0 {
            return Err(PoolError::InsufficientLiquidity);
        }

        // Apply fee: amount_in * (10000 - fee_rate) / 10000
        let amount_in_with_fee = (amount_in as u128 * (10000 - self.fee_rate) as u128) / 10000;
        let numerator = amount_in_with_fee * reserve_out as u128;
        let denominator = (reserve_in as u128 * 10000) + amount_in_with_fee;

        let amount_out = (numerator / denominator) as u64;

        if amount_out == 0 {
            return Err(PoolError::InsufficientOutputAmount);
        }

        Ok(amount_out)
    }

    fn stable_swap_out(
        &self,
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
        amplification: u64,
    ) -> Result<u64, PoolError> {
        // Simplified Curve stable swap approximation
        // Full implementation would use Newton's method to solve the invariant

        // For now, use a hybrid approach:
        // - Low slippage near balance point
        // - Falls back to constant product for larger swaps

        let balance_ratio = if reserve_in > reserve_out {
            reserve_in as f64 / reserve_out as f64
        } else {
            reserve_out as f64 / reserve_in as f64
        };

        // If reserves are balanced (ratio < 1.1), use amplified calculation
        if balance_ratio < 1.1 {
            let amplified_reserve_in = reserve_in as u128 * amplification as u128;
            let amplified_reserve_out = reserve_out as u128 * amplification as u128;

            let amount_in_with_fee = (amount_in as u128 * (10000 - self.fee_rate) as u128) / 10000;
            let numerator = amount_in_with_fee * amplified_reserve_out;
            let denominator = amplified_reserve_in + amount_in_with_fee;

            let amount_out = (numerator / denominator) as u64;
            Ok(amount_out)
        } else {
            // Fall back to constant product for unbalanced pools
            self.constant_product_out(amount_in, reserve_in, reserve_out)
        }
    }

    fn weighted_pool_out(
        &self,
        amount_in: u64,
        reserve_in: u64,
        reserve_out: u64,
        weight_in: u8,
        weight_out: u8,
    ) -> Result<u64, PoolError> {
        // Balancer weighted pool formula
        // amount_out = reserve_out * (1 - (reserve_in / (reserve_in + amount_in))^(weight_in/weight_out))

        let amount_in_with_fee = (amount_in as u128 * (10000 - self.fee_rate) as u128) / 10000;

        let ratio = (reserve_in as f64 / (reserve_in as f64 + amount_in_with_fee as f64))
            .powf(weight_in as f64 / weight_out as f64);

        let amount_out = (reserve_out as f64 * (1.0 - ratio)) as u64;

        if amount_out == 0 {
            return Err(PoolError::InsufficientOutputAmount);
        }

        Ok(amount_out)
    }

    /// Calculate input amount needed for desired output
    #[allow(dead_code)]
    pub fn get_amount_in(&self, amount_out: u64, token_out: &str) -> Result<u64, PoolError> {
        if self.paused {
            return Err(PoolError::PoolPaused);
        }

        let (reserve_in, reserve_out) = if token_out == self.token_a {
            (self.reserve_b, self.reserve_a)
        } else if token_out == self.token_b {
            (self.reserve_a, self.reserve_b)
        } else {
            return Err(PoolError::InvalidToken);
        };

        if amount_out >= reserve_out {
            return Err(PoolError::InsufficientLiquidity);
        }

        let numerator = reserve_in as u128 * amount_out as u128 * 10000;
        let denominator =
            (reserve_out as u128 - amount_out as u128) * (10000 - self.fee_rate) as u128;

        // Add 1 for rounding up
        let amount_in = (numerator / denominator + 1) as u64;

        Ok(amount_in)
    }

    /// Calculate LP tokens to mint for a liquidity deposit
    pub fn calculate_lp_mint(&self, amount_a: u64, amount_b: u64) -> Result<u64, PoolError> {
        if self.total_lp_supply == 0 {
            // First deposit
            return Ok(((amount_a as u128 * amount_b as u128).integer_sqrt()) as u64 - 1000);
        }

        // Calculate based on the smaller ratio to prevent imbalanced deposits
        let liquidity_a =
            (amount_a as u128 * self.total_lp_supply as u128) / self.reserve_a as u128;
        let liquidity_b =
            (amount_b as u128 * self.total_lp_supply as u128) / self.reserve_b as u128;

        log::debug!(
            "[pool] calculate_lp_mint: amount_a={} amount_b={} total_lp_supply={} reserve_a={} reserve_b={} liquidity_a={} liquidity_b={}",
            amount_a, amount_b, self.total_lp_supply, self.reserve_a, self.reserve_b, liquidity_a, liquidity_b
        );

        let liquidity = liquidity_a.min(liquidity_b) as u64;

        // Allow very small liquidity amounts (minimum 1 wei)
        if liquidity == 0 {
            log::warn!(
                "[pool] InsufficientLiquidityMinted: liquidity_a={} liquidity_b={} min={}",
                liquidity_a,
                liquidity_b,
                liquidity
            );
            return Err(PoolError::InsufficientLiquidityMinted);
        }

        Ok(liquidity)
    }

    /// Calculate optimal deposit amounts to match pool ratio
    pub fn calculate_optimal_amounts(
        &self,
        amount_a_desired: u64,
        amount_b_desired: u64,
    ) -> (u64, u64) {
        if self.reserve_a == 0 || self.reserve_b == 0 {
            return (amount_a_desired, amount_b_desired);
        }

        let amount_b_optimal =
            (amount_a_desired as u128 * self.reserve_b as u128) / self.reserve_a as u128;

        if amount_b_optimal <= amount_b_desired as u128 {
            return (amount_a_desired, amount_b_optimal as u64);
        }

        let amount_a_optimal =
            (amount_b_desired as u128 * self.reserve_a as u128) / self.reserve_b as u128;
        (amount_a_optimal as u64, amount_b_desired)
    }

    /// Calculate token amounts when removing liquidity
    pub fn calculate_remove_amounts(&self, lp_tokens: u64) -> Result<(u64, u64), PoolError> {
        if lp_tokens == 0 {
            return Err(PoolError::InsufficientLiquidityBurned);
        }
        if lp_tokens > self.total_lp_supply {
            return Err(PoolError::InsufficientLPTokens);
        }

        let amount_a = (lp_tokens as u128 * self.reserve_a as u128) / self.total_lp_supply as u128;
        let amount_b = (lp_tokens as u128 * self.reserve_b as u128) / self.total_lp_supply as u128;

        Ok((amount_a as u64, amount_b as u64))
    }

    /// Calculate price impact for a swap
    pub fn calculate_price_impact(&self, amount_in: u64, token_in: &str) -> Result<f64, PoolError> {
        let (reserve_in, reserve_out) = if token_in == self.token_a {
            (self.reserve_a, self.reserve_b)
        } else if token_in == self.token_b {
            (self.reserve_b, self.reserve_a)
        } else {
            return Err(PoolError::InvalidToken);
        };

        let mid_price = reserve_out as f64 / reserve_in as f64;
        let amount_out = self.get_amount_out(amount_in, token_in)?;
        let execution_price = amount_out as f64 / amount_in as f64;

        let impact = ((execution_price - mid_price) / mid_price).abs() * 100.0;

        Ok(impact)
    }

    /// Get current spot price (without slippage)
    #[allow(dead_code)]
    pub fn spot_price(&self, token_in: &str) -> Result<f64, PoolError> {
        let (reserve_in, reserve_out) = if token_in == self.token_a {
            (self.reserve_a, self.reserve_b)
        } else if token_in == self.token_b {
            (self.reserve_b, self.reserve_a)
        } else {
            return Err(PoolError::InvalidToken);
        };

        if reserve_in == 0 {
            return Err(PoolError::InsufficientLiquidity);
        }

        Ok(reserve_out as f64 / reserve_in as f64)
    }

    /// Execute a swap (updates reserves)
    #[allow(dead_code)]
    pub fn execute_swap(
        &mut self,
        amount_in: u64,
        token_in: &str,
        min_amount_out: u64,
    ) -> Result<u64, PoolError> {
        let amount_out = self.get_amount_out(amount_in, token_in)?;

        if amount_out < min_amount_out {
            return Err(PoolError::SlippageExceeded);
        }

        // Update reserves
        if token_in == self.token_a {
            self.reserve_a += amount_in;
            self.reserve_b -= amount_out;
        } else {
            self.reserve_b += amount_in;
            self.reserve_a -= amount_out;
        }

        // Collect protocol fee (20% of swap fee)
        let fee = (amount_in as u128 * self.fee_rate as u128) / 10000;
        let protocol_fee = (fee * 20) / 100;

        if token_in == self.token_a {
            self.protocol_fees_a += protocol_fee as u64;
        } else {
            self.protocol_fees_b += protocol_fee as u64;
        }

        Ok(amount_out)
    }

    /// Add liquidity to pool
    #[allow(dead_code)]
    pub fn add_liquidity(
        &mut self,
        amount_a: u64,
        amount_b: u64,
        min_liquidity: u64,
    ) -> Result<u64, PoolError> {
        let lp_tokens = self.calculate_lp_mint(amount_a, amount_b)?;

        if lp_tokens < min_liquidity {
            return Err(PoolError::SlippageExceeded);
        }

        self.reserve_a += amount_a;
        self.reserve_b += amount_b;
        self.total_lp_supply += lp_tokens;

        Ok(lp_tokens)
    }

    /// Remove liquidity from pool
    #[allow(dead_code)]
    pub fn remove_liquidity(
        &mut self,
        lp_tokens: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> Result<(u64, u64), PoolError> {
        let (amount_a, amount_b) = self.calculate_remove_amounts(lp_tokens)?;

        if amount_a < min_amount_a || amount_b < min_amount_b {
            return Err(PoolError::SlippageExceeded);
        }

        self.reserve_a -= amount_a;
        self.reserve_b -= amount_b;
        self.total_lp_supply -= lp_tokens;

        Ok((amount_a, amount_b))
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum PoolError {
    PoolAlreadyExists,
    PoolNotFound,
    PoolPaused,
    InvalidToken,
    InsufficientLiquidity,
    InsufficientInputAmount,
    InsufficientOutputAmount,
    InsufficientLiquidityMinted,
    InsufficientLiquidityBurned,
    InsufficientLPTokens,
    SlippageExceeded,
    ExcessivePriceImpact,
}

// Helper trait for integer square root
trait IntegerSqrt {
    fn integer_sqrt(self) -> Self;
}

impl IntegerSqrt for u128 {
    fn integer_sqrt(self) -> Self {
        if self < 2 {
            return self;
        }

        let mut x = self;
        let mut y = (x + 1) / 2;

        while y < x {
            x = y;
            y = (x + self / x) / 2;
        }

        x
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_creation() {
        let manager = PoolManager::new();
        let pool_id = manager
            .create_pool(
                "USDT".to_string(),
                "USDX".to_string(),
                1_000_000,
                1_000_000,
                30,
                PoolType::ConstantProduct,
            )
            .unwrap();

        assert_eq!(pool_id, "USDT-USDX");

        let pool = manager.get_pool(&pool_id).unwrap();
        assert_eq!(pool.reserve_a, 1_000_000);
        assert_eq!(pool.reserve_b, 1_000_000);
    }

    #[test]
    fn test_constant_product_swap() {
        let manager = PoolManager::new();
        let pool_id = manager
            .create_pool(
                "USDT".to_string(),
                "USDX".to_string(),
                1_000_000,
                1_000_000,
                30,
                PoolType::ConstantProduct,
            )
            .unwrap();

        let pool = manager.get_pool(&pool_id).unwrap();

        // Swap 1000 USDT -> USDX
        let amount_out = pool.get_amount_out(1000, "USDT").unwrap();

        // With 0.3% fee: (1000 * 0.997 * 1_000_000) / (1_000_000 + 1000 * 0.997)
        // ≈ 996
        assert!(amount_out > 995 && amount_out < 998);
    }

    #[test]
    fn test_add_liquidity() {
        let manager = PoolManager::new();
        let pool_id = manager
            .create_pool(
                "USDT".to_string(),
                "USDX".to_string(),
                1_000_000,
                1_000_000,
                30,
                PoolType::ConstantProduct,
            )
            .unwrap();

        let mut pool = manager.get_pool(&pool_id).unwrap();

        // Add 10% more liquidity
        let lp_tokens = pool.add_liquidity(100_000, 100_000, 0).unwrap();

        // Should get ~10% of total supply (minus minimum liquidity)
        let expected = pool.total_lp_supply / 10;
        assert!(lp_tokens > expected - 1000 && lp_tokens < expected + 1000);
    }

    #[test]
    fn test_remove_liquidity() {
        let manager = PoolManager::new();
        let pool_id = manager
            .create_pool(
                "USDT".to_string(),
                "USDX".to_string(),
                1_000_000,
                1_000_000,
                30,
                PoolType::ConstantProduct,
            )
            .unwrap();

        let mut pool = manager.get_pool(&pool_id).unwrap();

        // Remove 10% of liquidity
        let lp_to_burn = pool.total_lp_supply / 10;
        let (amount_a, amount_b) = pool.remove_liquidity(lp_to_burn, 0, 0).unwrap();

        // Should get back ~10% of reserves
        assert!(amount_a > 95_000 && amount_a < 105_000);
        assert!(amount_b > 95_000 && amount_b < 105_000);
    }

    #[test]
    fn test_price_impact() {
        let manager = PoolManager::new();
        let pool_id = manager
            .create_pool(
                "USDT".to_string(),
                "USDX".to_string(),
                1_000_000,
                1_000_000,
                30,
                PoolType::ConstantProduct,
            )
            .unwrap();

        let pool = manager.get_pool(&pool_id).unwrap();

        // Small swap should have minimal impact
        let impact_small = pool.calculate_price_impact(1000, "USDT").unwrap();
        assert!(impact_small < 0.2); // < 0.2%

        // Large swap should have significant impact
        let impact_large = pool.calculate_price_impact(100_000, "USDT").unwrap();
        assert!(impact_large > 5.0); // > 5%
    }
}
