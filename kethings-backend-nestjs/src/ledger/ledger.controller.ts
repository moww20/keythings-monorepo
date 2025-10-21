import { Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Query } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerQueryDto } from './dto/query.dto';

@Controller('ledger/v1/accounts')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ledger-service'
    };
  }

  @Get(':publicKey/history')
  async history(
    @Param('publicKey') publicKey: string,
    @Query() query: LedgerQueryDto,
  ) {
    try {
      const limit = query.limit;
      const includeOps = query.includeOps;
      return await this.ledger.getHistory(publicKey, limit, includeOps);
    } catch (error) {
      console.error('Error in history endpoint:', error);
      return {
        account: publicKey,
        network: 'test',
        items: [],
        relevantOps: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  @Get(':publicKey/chain')
  async chain(
    @Param('publicKey') publicKey: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      return await this.ledger.getChain(publicKey, limit);
    } catch (error) {
      console.error('Error in chain endpoint:', error);
      return {
        account: publicKey,
        network: 'test',
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  @Get(':publicKey/operations')
  async operations(
    @Param('publicKey') publicKey: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      return await this.ledger.getOperations(publicKey, limit);
    } catch (error) {
      console.error('Error in operations endpoint:', error);
      return {
        account: publicKey,
        network: 'test',
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  @Get(':publicKey/balance')
  async balance(
    @Param('publicKey') publicKey: string,
  ) {
    try {
      return await this.ledger.getBalance(publicKey);
    } catch (error) {
      console.error('Error in balance endpoint:', error);
      return {
        account: publicKey,
        network: 'test',
        balance: '0',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
