import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LedgerModule } from './ledger/ledger.module';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LedgerModule,
    MarketDataModule,
  ],
})
export class AppModule {}
