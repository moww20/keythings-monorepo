import { Controller, Get, Query } from '@nestjs/common';

import { ChartQueryDto } from './dto/chart-query.dto';
import { MarketDataService } from './market-data.service';

@Controller('market-data/v1')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get('charts/kta-usdt')
  async ktaUsdtChart(@Query() query: ChartQueryDto) {
    const result = await this.marketData.getKtaUsdtChart(query.timeframe);
    return result;
  }
}
