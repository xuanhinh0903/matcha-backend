import { ApiProperty } from '@nestjs/swagger';

export class UserMatchStatsDto {
  @ApiProperty()
  user_id: number;

  @ApiProperty({
    type: 'object',
    properties: {
      totalMatches: { type: 'number' },
      likesReceived: { type: 'number' },
      matchRate: { type: 'number' },
    },
  })
  matchStats: {
    totalMatches: number;
    likesReceived: number;
    matchRate: number;
  };
}
