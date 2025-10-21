import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [ConfigModule],
  providers: [LedgerService],
  controllers: [LedgerController],
})
export class LedgerModule {}
