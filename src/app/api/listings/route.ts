import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ListingSchema, ListingsResponseSchema, NewListingSchema, type Listing } from '@/app/types/listing'

export const dynamic = 'force-dynamic'

// In-memory storage for listings (keyed by token address to prevent duplicates)
const listingsStore = new Map<string, Listing>()

export async function GET(): Promise<NextResponse> {
  const listings = Array.from(listingsStore.values())
  const response = ListingsResponseSchema.parse({ listings })
  return NextResponse.json(response, { status: 200 })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null)
  const parsed = NewListingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Check if listing already exists
  const existing = listingsStore.get(parsed.data.address)
  if (existing) {
    // Update existing listing
    const updated = ListingSchema.parse({
      ...existing,
      ...parsed.data,
      createdAt: existing.createdAt || new Date().toISOString(),
      status: existing.status || 'active',
    })
    listingsStore.set(parsed.data.address, updated)
    return NextResponse.json({ ok: true, listing: updated }, { status: 200 })
  }

  // Create new listing
  const nowIso = new Date().toISOString()
  const listingCandidate = {
    ...parsed.data,
    createdAt: nowIso,
    status: 'active' as const,
  }

  const listing = ListingSchema.parse(listingCandidate)
  listingsStore.set(parsed.data.address, listing)
  return NextResponse.json({ ok: true, listing }, { status: 200 })
}

