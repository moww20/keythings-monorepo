import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LedgerModule } from './ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LedgerModule,
  ],
})
export class AppModule {}
