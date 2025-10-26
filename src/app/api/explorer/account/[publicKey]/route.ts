import { NextResponse } from "next/server";
import { fetchAccount } from "@/lib/explorer/client-reads-ssr";

interface RouteContext {
  params: Promise<{
    publicKey: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { publicKey } = await params;
  
  console.log('[API_ROUTE] GET request received for publicKey:', publicKey);
  
  if (!publicKey) {
    console.log('[API_ROUTE] No publicKey provided, returning 400');
    return NextResponse.json(
      { error: "Public key is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`[API_ROUTE] Fetching account: ${publicKey}`);
    const account = await fetchAccount(publicKey);
    console.log(`[API_ROUTE] fetchAccount returned:`, account);

    if (!account) {
      console.log(`[API_ROUTE] Account not found: ${publicKey}`);
      return NextResponse.json(
        { 
          error: "Account not found",
          message: "Account data is not available. Please use the wallet extension to access account information.",
          suggestion: "Use window.keeta.getAccountInfo(address) in the browser console or connect your wallet to view account details."
        },
        { status: 404 }
      );
    }

    console.log(`[API_ROUTE] Successfully fetched account: ${publicKey}`);
    return NextResponse.json({ 
      success: true,
      account 
    });
    
  } catch (error) {
    console.error(`[API_ROUTE] Error fetching account ${publicKey}:`, error);

    if (error instanceof Error && /\b404\b/.test(error.message)) {
      return NextResponse.json(
        {
          error: "Account not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch account",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Ensure dynamic route handling
