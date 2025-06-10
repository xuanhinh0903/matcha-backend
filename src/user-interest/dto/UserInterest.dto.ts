import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserInterestDto {
  @ApiProperty({
    type: [Number],
    example: [2, 4, 7],
    description: 'Danh sách ID sở thích của người dùng',
  })
  @IsArray()
  @IsInt({ each: true })
  interestIds: number[];
}
