import { NextResponse } from "next/server";
import { fetchAccount } from "@/lib/explorer/client-reads-ssr";

interface RouteContext {
  params: Promise<{
    publicKey: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { publicKey } = await params;
  
  if (!publicKey) {
    return NextResponse.json(
      { error: "Public key is required" },
      { status: 400 }
    );
  }

  try {
    const account = await fetchAccount(publicKey);

    if (!account) {
      return NextResponse.json(
        { 
          error: "Account not found",
          message: "Account data is not available. Please use the wallet extension to access account information.",
          suggestion: "Use window.keeta.getAccountInfo(address) in the browser console or connect your wallet to view account details."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      account 
    });
    
  } catch (error) {

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
