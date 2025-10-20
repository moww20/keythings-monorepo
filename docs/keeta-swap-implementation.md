# Keeta Network Swap Implementation Guide

## Overview

This document provides a comprehensive guide for implementing atomic swaps on the Keeta Network using the native SDK operations. Keeta's swap system uses built-in `SendOperation` and `ReceiveOperation` primitives to enable atomic token exchanges without requiring smart contracts.

## Table of Contents

1. [How Keeta Swaps Work](#how-keeta-swaps-work)
2. [SDK Implementation](#sdk-implementation)
3. [Operation Types](#operation-types)
4. [Transaction Structure](#transaction-structure)
5. [Implementation Examples](#implementation-examples)
6. [Best Practices](#best-practices)
7. [Error Handling](#error-handling)
8. [Testing](#testing)

## How Keeta Swaps Work

### Two-Phase Atomic Swap Process

Keeta implements atomic swaps using a two-phase approach:

1. **Phase 1 - Initiation**: 
   - Party A creates a transaction with `send()` and `receive()` operations
   - Computes the transaction block but **does not publish it**
   - Sends the unsigned block to Party B

2. **Phase 2 - Completion**:
   - Party B verifies the transaction
   - Party B signs and publishes the transaction
   - Swap is atomically executed

### Key Benefits

- **Atomic Execution**: Either both parties get their tokens or neither does
- **No Smart Contracts**: Uses native Keeta operations
- **Fast Settlement**: 400ms settlement time
- **High Throughput**: 10M TPS capability
- **Cross-Chain Ready**: Built for interoperability

## SDK Implementation

### JavaScript/TypeScript SDK

```javascript
const KeetaNet = require('@keetanetwork/keetanet-client');

// Initialize client
const signer = KeetaNet.lib.Account.fromSeed(DEMO_ACCOUNT_SEED, 0);
const client = KeetaNet.UserClient.fromNetwork('test', signer);

// Define swap parameters
const recipient = KeetaNet.lib.Account.fromPublicKeyString('<recipient-address>');
const sendToken = KeetaNet.lib.Account.fromPublicKeyString('<abc-token-address>');
const receiveToken = KeetaNet.lib.Account.fromPublicKeyString('<xyz-token-address>');

// Amounts (with proper decimal handling)
const sendAmount = Numeric.fromDecimalString("10.0", 2); // 10 ABC
const receiveAmount = Numeric.fromDecimalString("5.0", 2); // 5 XYZ

// Create swap transaction
const builder = client.initBuilder();
builder.send(recipient, sendAmount.valueOf(), sendToken);
builder.receive(recipient, receiveAmount.valueOf(), receiveToken, true);

// Compute the transaction block (NOT published yet)
const {blocks} = await client.computeBuilderBlocks(builder);

// Send unsigned block to counterparty
const unsignedBytes = blocks[0].toBytes();
console.log("📦 Unsigned swap block ready for signature:", unsignedBytes);
```

### Swift SDK

```swift
// Swift SDK implementation
try await client.swap(
    with: recipient,
    offer: .init(amount: BigInt(1), token: newToken),
    ask: .init(amount: BigInt(5), token: newToken)
)
```

## Operation Types

### Operation Type 0: SendOperation
- **Purpose**: Standard token transfer
- **Effects**: 
  - Decrements sender's balance
  - Increments recipient's balance
  - Validates sender has sufficient balance

### Operation Type 7: ReceiveOperation
- **Purpose**: Declare expected token receipt in swaps
- **Effects**:
  - Validates incoming token amount
  - Updates recipient's balance
  - Enables atomic swap completion

### Transaction Structure Example

```json
{
  "operations": [
    {
      "type": 0,  // SendOperation
      "to": "keeta_aabqccn4d7xhyukmpfnwjv22b23dpczzs2ay2nieaaskovep2h7jcpucklqjdli",
      "amount": "0xF4240",  // 1,000,000 units
      "token": "keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52"
    },
    {
      "type": 7,  // ReceiveOperation
      "amount": "0x287FDFA76915",  // Amount to receive
      "token": "keeta_apns2hdnvsyamyyfunfvga35ydszoecx35igta6663sculh7e52hhwu3nv4la",
      "from": "keeta_aabqccn4d7xhyukmpfnwjv22b23dpczzs2ay2nieaaskovep2h7jcpucklqjdli",
      "exact": false  // Flexible amount (not exact)
    }
  ]
}
```

## Implementation Examples

### Basic Swap Implementation

```typescript
interface SwapParams {
  recipient: string;
  sendToken: string;
  receiveToken: string;
  sendAmount: string;
  receiveAmount: string;
  exact?: boolean;
}

class KeetaSwap {
  private client: any;
  
  constructor(client: any) {
    this.client = client;
  }

  async createSwap(params: SwapParams) {
    const {
      recipient,
      sendToken,
      receiveToken,
      sendAmount,
      receiveAmount,
      exact = false
    } = params;

    // Create recipient account
    const recipientAccount = KeetaNet.lib.Account.fromPublicKeyString(recipient);
    const sendTokenAccount = KeetaNet.lib.Account.fromPublicKeyString(sendToken);
    const receiveTokenAccount = KeetaNet.lib.Account.fromPublicKeyString(receiveToken);

    // Parse amounts with proper decimals
    const sendAmountNumeric = Numeric.fromDecimalString(sendAmount, 2);
    const receiveAmountNumeric = Numeric.fromDecimalString(receiveAmount, 2);

    // Build transaction
    const builder = this.client.initBuilder();
    builder.send(recipientAccount, sendAmountNumeric.valueOf(), sendTokenAccount);
    builder.receive(recipientAccount, receiveAmountNumeric.valueOf(), receiveTokenAccount, exact);

    // Compute blocks (unsigned)
    const {blocks} = await this.client.computeBuilderBlocks(builder);
    
    return {
      unsignedBlock: blocks[0].toBytes(),
      blockHash: blocks[0].hash,
      operations: blocks[0].operations
    };
  }

  async executeSwap(unsignedBlockBytes: Uint8Array) {
    // Verify and sign the block
    const block = KeetaNet.lib.Block.fromBytes(unsignedBlockBytes);
    
    // Publish the signed transaction
    const result = await this.client.publishBlock(block);
    
    return result;
  }
}
```

### Advanced Swap with Validation

```typescript
class AdvancedKeetaSwap extends KeetaSwap {
  async validateSwap(swapParams: SwapParams): Promise<boolean> {
    try {
      // Check sender has sufficient balance
      const balance = await this.client.getBalance(swapParams.sendToken);
      const requiredAmount = BigInt(swapParams.sendAmount);
      
      if (balance < requiredAmount) {
        throw new Error('Insufficient balance for swap');
      }

      // Validate token addresses
      await this.validateTokenAddress(swapParams.sendToken);
      await this.validateTokenAddress(swapParams.receiveToken);

      // Check recipient address
      await this.validateRecipientAddress(swapParams.recipient);

      return true;
    } catch (error) {
      console.error('Swap validation failed:', error);
      return false;
    }
  }

  private async validateTokenAddress(tokenAddress: string): Promise<void> {
    // Implement token address validation
    // Check if token exists and is valid
  }

  private async validateRecipientAddress(recipient: string): Promise<void> {
    // Implement recipient address validation
    // Check if address is valid Keeta address
  }
}
```

## Best Practices

### 1. Amount Handling
```typescript
// Always use proper decimal handling
const amount = Numeric.fromDecimalString("10.5", 2); // 10.50 with 2 decimals
const bigIntAmount = amount.valueOf(); // Convert to BigInt for operations
```

### 2. Error Handling
```typescript
try {
  const swapResult = await createSwap(swapParams);
  console.log('Swap created successfully:', swapResult);
} catch (error) {
  if (error.message.includes('Insufficient balance')) {
    // Handle insufficient balance
  } else if (error.message.includes('Invalid token')) {
    // Handle invalid token
  } else {
    // Handle other errors
    console.error('Swap creation failed:', error);
  }
}
```

### 3. Transaction Verification
```typescript
async function verifySwapTransaction(blockHash: string): Promise<boolean> {
  try {
    const transaction = await client.getTransaction(blockHash);
    
    // Verify all operations are present
    const hasSendOp = transaction.operations.some(op => op.type === 0);
    const hasReceiveOp = transaction.operations.some(op => op.type === 7);
    
    return hasSendOp && hasReceiveOp;
  } catch (error) {
    console.error('Transaction verification failed:', error);
    return false;
  }
}
```

### 4. Swap State Management
```typescript
enum SwapState {
  PENDING = 'pending',
  SIGNED = 'signed',
  PUBLISHED = 'published',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

class SwapManager {
  private swaps: Map<string, SwapState> = new Map();

  async trackSwap(swapId: string, blockHash: string) {
    this.swaps.set(swapId, SwapState.PENDING);
    
    // Monitor transaction status
    const interval = setInterval(async () => {
      const status = await this.checkSwapStatus(blockHash);
      this.swaps.set(swapId, status);
      
      if (status === SwapState.COMPLETED || status === SwapState.FAILED) {
        clearInterval(interval);
      }
    }, 1000);
  }

  private async checkSwapStatus(blockHash: string): Promise<SwapState> {
    // Implement status checking logic
    return SwapState.COMPLETED;
  }
}
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Balance**
```typescript
if (error.message.includes('Insufficient balance')) {
  // Handle insufficient balance
  throw new Error('Not enough tokens to complete swap');
}
```

2. **Invalid Token Address**
```typescript
if (error.message.includes('Invalid token')) {
  // Handle invalid token
  throw new Error('Token address is invalid or does not exist');
}
```

3. **Network Issues**
```typescript
if (error.code === 'NETWORK_ERROR') {
  // Handle network issues
  throw new Error('Network connection failed. Please try again.');
}
```

## Testing

### Unit Tests
```typescript
describe('KeetaSwap', () => {
  let swap: KeetaSwap;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockClient();
    swap = new KeetaSwap(mockClient);
  });

  it('should create a valid swap transaction', async () => {
    const params = {
      recipient: 'keeta_test_recipient',
      sendToken: 'keeta_test_send_token',
      receiveToken: 'keeta_test_receive_token',
      sendAmount: '10.0',
      receiveAmount: '5.0'
    };

    const result = await swap.createSwap(params);
    
    expect(result.unsignedBlock).toBeDefined();
    expect(result.blockHash).toBeDefined();
    expect(result.operations).toHaveLength(2);
  });

  it('should handle insufficient balance', async () => {
    mockClient.getBalance.mockResolvedValue(0);
    
    const params = {
      recipient: 'keeta_test_recipient',
      sendToken: 'keeta_test_send_token',
      receiveToken: 'keeta_test_receive_token',
      sendAmount: '10.0',
      receiveAmount: '5.0'
    };

    await expect(swap.createSwap(params)).rejects.toThrow('Insufficient balance');
  });
});
```

### Integration Tests
```typescript
describe('Swap Integration', () => {
  it('should complete a full swap cycle', async () => {
    // Create swap
    const swapResult = await swap.createSwap(validParams);
    
    // Execute swap
    const executionResult = await swap.executeSwap(swapResult.unsignedBlock);
    
    // Verify completion
    expect(executionResult.status).toBe('completed');
  });
});
```

## Security Considerations

1. **Private Key Management**: Never expose private keys in client-side code
2. **Transaction Validation**: Always validate transaction parameters before execution
3. **Amount Verification**: Double-check amounts and token addresses
4. **Network Security**: Use HTTPS for all network communications
5. **Error Handling**: Don't expose sensitive information in error messages

## Performance Optimization

1. **Batch Operations**: Group multiple swaps when possible
2. **Connection Pooling**: Reuse client connections
3. **Caching**: Cache frequently accessed data
4. **Async Operations**: Use async/await for non-blocking operations

## Conclusion

Keeta's native swap implementation provides a robust, fast, and secure way to perform atomic token exchanges without smart contracts. By following this guide and implementing proper error handling and validation, you can create reliable swap functionality for your Keeta-based applications.

## Resources

- [Keeta Network Documentation](https://docs.keeta.com)
- [JavaScript SDK Reference](https://static.test.keeta.com/docs)
- [Swift SDK Reference](https://docs.keeta.com/swift-sdk)
- [Keeta Network Explorer](https://explorer.keeta.com)

---

*Last updated: $(date)*
*Version: 1.0*
