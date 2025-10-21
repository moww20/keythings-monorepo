const KeetaNet = require('@keetanetwork/keetanet-client');

async function debugKeetaBackend() {
  try {
    console.log('🔍 Debugging Keeta SDK in backend environment...');
    
    const publicKey = 'keeta_aabnbni4wzpbxcsbdwffi3bsbtso4dftgwhixafwkgcwigvs6cwwznrb3qnmqxa';
    console.log('📝 Testing with account:', publicKey);
    
    // Test 1: Check if KeetaNet is available
    console.log('🔍 KeetaNet object:', typeof KeetaNet);
    console.log('🔍 KeetaNet.lib:', typeof KeetaNet.lib);
    console.log('🔍 KeetaNet.UserClient:', typeof KeetaNet.UserClient);
    
    // Test 2: Create account
    console.log('📝 Creating account...');
    const account = await KeetaNet.lib.Account.fromPublicKeyString(publicKey);
    console.log('✅ Account created:', typeof account);
    
    // Test 3: Create client with null signer
    console.log('📝 Creating client with null signer...');
    const client = KeetaNet.UserClient.fromNetwork('test', null, { account });
    console.log('✅ Client created:', typeof client);
    console.log('🔍 Client methods:', Object.keys(client));
    
    // Test 4: Test history method
    console.log('📝 Testing history method...');
    if (typeof client.history === 'function') {
      console.log('✅ History method is available');
      const history = await client.history();
      console.log('📊 History result type:', typeof history);
      console.log('📊 History is array:', Array.isArray(history));
      console.log('📊 History length:', Array.isArray(history) ? history.length : 'Not an array');
      
      if (Array.isArray(history) && history.length > 0) {
        console.log('✅ History has data!');
        console.log('📊 First item:', history[0]);
      } else {
        console.log('❌ History is empty');
      }
    } else {
      console.log('❌ History method not available');
    }
    
    // Test 5: Test chain method
    console.log('📝 Testing chain method...');
    if (typeof client.chain === 'function') {
      console.log('✅ Chain method is available');
      const chain = await client.chain();
      console.log('📊 Chain result type:', typeof chain);
      console.log('📊 Chain is array:', Array.isArray(chain));
      console.log('📊 Chain length:', Array.isArray(chain) ? chain.length : 'Not an array');
    } else {
      console.log('❌ Chain method not available');
    }
    
    console.log('✅ All tests completed');
    
  } catch (error) {
    console.error('❌ Error in debug:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

debugKeetaBackend().then(() => {
  console.log('✅ Debug completed');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Debug failed:', err);
  process.exit(1);
});


