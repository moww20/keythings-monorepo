// Test if the service can execute Keeta SDK calls
const KeetaNet = require('@keetanetwork/keetanet-client');

async function testServiceKeeta() {
  try {
    console.log('🔍 Testing service Keeta SDK execution...');
    
    const publicKey = 'keeta_aabnbni4wzpbxcsbdwffi3bsbtso4dftgwhixafwkgcwigvs6cwwznrb3qnmqxa';
    
    // Simulate the service logic
    console.log('📝 Creating account...');
    const account = await KeetaNet.lib.Account.fromPublicKeyString(publicKey);
    console.log('✅ Account created');
    
    console.log('📝 Creating client...');
    const client = KeetaNet.UserClient.fromNetwork('test', null, { account });
    console.log('✅ Client created');
    
    console.log('📝 Testing history...');
    const history = await client.history();
    console.log('📊 History length:', Array.isArray(history) ? history.length : 'Not an array');
    
    if (Array.isArray(history) && history.length > 0) {
      console.log('✅ Service can execute Keeta SDK calls!');
      
      // Transform the data like the service would
      const items = history.slice(0, 3).map((staple, index) => ({
        stapleHash: `staple_${index}`,
        producer: 'test_producer',
        timestamp: Date.now() - (index * 1000),
        operationsCount: 1
      }));
      
      const relevantOps = history.slice(0, 3).map((staple, index) => ({
        type: 'SEND',
        from: publicKey,
        to: 'keeta_recipient',
        amount: '100',
        token: 'keeta_token',
        timestamp: Date.now() - (index * 1000)
      }));
      
      console.log('📊 Transformed items:', items.length);
      console.log('📊 Transformed ops:', relevantOps.length);
      
      const result = {
        account: publicKey,
        network: 'test',
        items: items,
        relevantOps: relevantOps
      };
      
      console.log('✅ Service result:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Service cannot execute Keeta SDK calls');
    }
    
  } catch (error) {
    console.error('❌ Error in service test:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

testServiceKeeta();


