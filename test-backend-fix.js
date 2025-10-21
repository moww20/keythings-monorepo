const KeetaNet = require('@keetanetwork/keetanet-client');

async function testBackendFix() {
  try {
    console.log('🔍 Testing backend fix with null signer...');
    
    const publicKey = 'keeta_aabnbni4wzpbxcsbdwffi3bsbtso4dftgwhixafwkgcwigvs6cwwznrb3qnmqxa';
    console.log('📝 Testing with account:', publicKey);
    
    // Create account from public key
    const account = await KeetaNet.lib.Account.fromPublicKeyString(publicKey);
    console.log('✅ Account created successfully');
    
    // Test the fix: Use null signer with account in options
    const client = KeetaNet.UserClient.fromNetwork('test', null, { account });
    console.log('✅ Read-only client created successfully');
    
    // Test history with limit
    console.log('📜 Testing history with limit 5...');
    const history = await client.history();
    console.log('📊 History length:', Array.isArray(history) ? history.length : 'Not an array');
    
    // Test chain
    console.log('🔗 Testing chain...');
    const chain = await client.chain();
    console.log('📊 Chain length:', Array.isArray(chain) ? chain.length : 'Not an array');
    
    // Test balances
    console.log('💰 Testing balances...');
    const balances = await client.allBalances();
    console.log('📊 Balances:', balances);
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing backend fix:', error);
    console.error('❌ Error details:', error.message);
  }
}

testBackendFix().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});


