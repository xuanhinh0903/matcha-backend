import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveReportDto {
  @ApiProperty({
    enum: ['ignore', 'ban', 'delete'],
    description: 'Action to take on the reported user',
    example: 'ban',
  })
  @IsEnum(['ignore', 'ban', 'delete'])
  action: 'ignore' | 'ban' | 'delete';

  @ApiProperty({
    required: false,
    description: 'Reason for the action (required for ban)',
    example: 'Violation of community guidelines - inappropriate content',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    required: false,
    description: 'Number of days to ban the user (optional for ban action)',
    example: 7,
  })
  @IsNumber()
  @IsOptional()
  banDays?: number;
}
