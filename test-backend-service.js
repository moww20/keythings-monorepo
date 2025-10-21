const fetch = require('node-fetch');

async function testBackendService() {
  try {
    console.log('🔍 Testing backend service execution...');
    
    // Test the health endpoint first
    console.log('📝 Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:8080/api/ledger/v1/accounts/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint working:', healthData);
    } else {
      console.log('❌ Health endpoint failed:', healthResponse.status);
      return;
    }
    
    // Test the history endpoint
    console.log('📝 Testing history endpoint...');
    const historyResponse = await fetch('http://localhost:8080/api/ledger/v1/accounts/keeta_aabnbni4wzpbxcsbdwffi3bsbtso4dftgwhixafwkgcwigvs6cwwznrb3qnmqxa/history?limit=3&includeOps=true');
    
    if (!historyResponse.ok) {
      console.log('❌ History endpoint failed:', historyResponse.status, historyResponse.statusText);
      return;
    }
    
    const historyData = await historyResponse.json();
    console.log('📊 History response:', JSON.stringify(historyData, null, 2));
    
    if (historyData.items && historyData.items.length > 0) {
      console.log('✅ Backend service is returning blockchain data!');
      console.log('📈 Items count:', historyData.items.length);
      console.log('📈 Relevant ops count:', historyData.relevantOps?.length || 0);
    } else {
      console.log('❌ Backend service is returning empty data');
      console.log('🔍 This means the service methods are not executing the Keeta SDK calls');
    }
    
  } catch (error) {
    console.error('❌ Error testing backend service:', error);
  }
}

testBackendService();


