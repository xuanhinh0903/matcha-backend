import { ApiProperty } from '@nestjs/swagger';

export class BasicUserProfileDto {
  @ApiProperty()
  user_id: number;

  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  full_name: string;

  @ApiProperty()
  age: number;

  @ApiProperty()
  bio: string;

  @ApiProperty({
    type: 'object',
    properties: {
      coordinates: {
        type: 'array',
        items: {
          type: 'number',
        },
        example: [20.123, 37.456],
      },
    },
  })
  location: {
    coordinates: [number, number];
  };

  @ApiProperty()
  last_active: Date;

  @ApiProperty()
  is_online: boolean;

  @ApiProperty()
  distance: number;

  @ApiProperty()
  gender?: string;
}
