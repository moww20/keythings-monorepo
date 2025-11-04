import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';

export enum ChartTimeframe {
  ONE_DAY = '1D',
  SEVEN_DAYS = '7D',
  THIRTY_DAYS = '30D',
  NINETY_DAYS = '90D',
}

export class ChartQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : undefined))
  @IsEnum(ChartTimeframe)
  timeframe: ChartTimeframe = ChartTimeframe.ONE_DAY;
}
