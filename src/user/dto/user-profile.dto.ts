import { ApiProperty } from '@nestjs/swagger';
import { Point } from 'geojson';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { UserPhoto } from '../../user-photo/entities/user-photo.entity';

export class UserProfileDto {
  @ApiProperty()
  user_id: number;

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

  @ApiProperty({ type: [UserInterest] })
  interests: UserInterest[];

  @ApiProperty({ type: [UserPhoto] })
  photos: UserPhoto[];
}
