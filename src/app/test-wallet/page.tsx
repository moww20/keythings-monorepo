'use client';

import { useEffect, useState } from 'react';

export default function TestWalletPage() {
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testWallet = async () => {
      try {
        // Check if window.keeta exists
        if (typeof window !== 'undefined' && (window as any).keeta) {
          const keeta = (window as any).keeta;
          console.log('🔍 [WALLET_TEST] Keeta object found:', keeta);
          console.log('🔍 [WALLET_TEST] Keeta methods:', Object.keys(keeta));
          
          // Test basic wallet connection
          const isConnected = await keeta.isConnected;
          console.log('🔍 [WALLET_TEST] Wallet connected:', isConnected);
          
          // Test RPC method availability
          if (typeof keeta.request === 'function') {
            console.log('🔍 [WALLET_TEST] RPC request method available');
            
            // Test a simple RPC call
            try {
              const testData = await keeta.request({ method: 'keeta_getHistoryForAccount', params: ['keeta_aabne43iyphlgibdvdx2yy2tiuukmrhtnec5quvda6qszbd26w6npyiik3tg5wi', { depth: 5 }] });
              console.log('🔍 [WALLET_TEST] RPC test successful:', testData);
              setWalletInfo({ connected: isConnected, rpcWorking: true, testData });
            } catch (rpcError) {
              console.log('🔍 [WALLET_TEST] RPC test failed:', rpcError);
              setWalletInfo({ connected: isConnected, rpcWorking: false, error: rpcError instanceof Error ? rpcError.message : String(rpcError) });
            }
          } else {
            console.log('🔍 [WALLET_TEST] RPC request method not available');
            setWalletInfo({ connected: isConnected, rpcWorking: false, error: 'No RPC method' });
          }
        } else {
          console.log('🔍 [WALLET_TEST] No Keeta object found');
          setError('No Keeta object found');
        }
      } catch (err) {
        console.error('🔍 [WALLET_TEST] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    testWallet();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Wallet Extension Test</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      {walletInfo && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <h2 className="font-bold">Wallet Status:</h2>
          <p>Connected: {walletInfo.connected ? 'Yes' : 'No'}</p>
          <p>RPC Working: {walletInfo.rpcWorking ? 'Yes' : 'No'}</p>
          {walletInfo.error && <p>Error: {walletInfo.error}</p>}
          {walletInfo.testData && (
            <div>
              <p>Test Data:</p>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                {JSON.stringify(walletInfo.testData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4">
        <p>Check the browser console for detailed logs with 🔍 [WALLET_TEST] prefix.</p>
      </div>
    </div>
  );
}
