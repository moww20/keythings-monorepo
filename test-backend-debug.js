const fetch = require('node-fetch');

async function testBackendDebug() {
  try {
    console.log('🔍 Testing backend with debug logging...');
    
    const response = await fetch('http://localhost:8080/api/ledger/v1/accounts/keeta_aabnbni4wzpbxcsbdwffi3bsbtso4dftgwhixafwkgcwigvs6cwwznrb3qnmqxa/history?limit=3&includeOps=true');
    
    if (!response.ok) {
      console.error('❌ Backend not responding:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('📊 Backend response:', JSON.stringify(data, null, 2));
    
    if (data.items && data.items.length > 0) {
      console.log('✅ Backend is returning blockchain data!');
      console.log('📈 Items count:', data.items.length);
      console.log('📈 Relevant ops count:', data.relevantOps?.length || 0);
    } else {
      console.log('❌ Backend is returning empty data');
      console.log('🔍 This means the Keeta SDK calls are not working in the backend');
    }
    
  } catch (error) {
    console.error('❌ Error testing backend:', error);
  }
}

testBackendDebug();


