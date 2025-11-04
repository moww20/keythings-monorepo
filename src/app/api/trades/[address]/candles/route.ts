import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CandlesResponseSchema } from '@/app/types/trade'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  timeframe: z.string().default('1D'),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> },
): Promise<NextResponse> {
  const { address } = await context.params
  const { searchParams } = new URL(request.url)
  const parsedQuery = QuerySchema.parse({ timeframe: searchParams.get('timeframe') ?? undefined })

  const response = CandlesResponseSchema.parse({ address, timeframe: parsedQuery.timeframe, candles: [] })
  return NextResponse.json(response, { status: 200 })
}



