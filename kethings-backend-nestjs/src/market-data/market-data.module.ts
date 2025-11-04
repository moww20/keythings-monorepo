import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [ConfigModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
})
export class MarketDataModule {}
