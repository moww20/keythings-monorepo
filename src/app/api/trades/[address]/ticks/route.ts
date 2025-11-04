import { NextRequest, NextResponse } from 'next/server'
import { TicksResponseSchema } from '@/app/types/trade'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ address: string }> },
): Promise<NextResponse> {
  const { address } = await context.params
  const response = TicksResponseSchema.parse({ address, ticks: [] })
  return NextResponse.json(response, { status: 200 })
}



