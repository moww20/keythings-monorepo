import { NextResponse } from "next/server";
import { fetchAccount } from "@/lib/explorer/client";

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
    console.log(`Fetching account: ${publicKey}`);
    const account = await fetchAccount(publicKey);

    if (!account) {
      console.log(`Account not found: ${publicKey}`);
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    console.log(`Successfully fetched account: ${publicKey}`);
    return NextResponse.json({ 
      success: true,
      account 
    });
    
  } catch (error) {
    console.error(`Error fetching account ${publicKey}:`, error);

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
