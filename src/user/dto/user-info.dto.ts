import { ApiProperty } from '@nestjs/swagger';
// import { Interest } from '../../interest/entities/interest.entity';
import { Point } from 'geojson';
// import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
// import { UserPhoto } from '../../user-photo/entities/user-photo.entity';

export class UserInfoDto {
  @ApiProperty()
  user_id: number;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone_number?: string;

  @ApiProperty({ required: false })
  full_name?: string;

  @ApiProperty({ required: false })
  birthdate?: Date;

  @ApiProperty({ required: false, enum: ['male', 'female', 'other'] })
  gender?: string;

  @ApiProperty({ required: false })
  location?: Point;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ required: false })
  last_active?: Date;

  @ApiProperty()
  is_online: boolean;

  @ApiProperty()
  is_verified: boolean;

  @ApiProperty({ required: false })
  profile_thumbnail?: string;
}
