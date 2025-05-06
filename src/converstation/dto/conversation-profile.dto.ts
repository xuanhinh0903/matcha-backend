import { ApiProperty } from '@nestjs/swagger';
import { Point } from 'geojson';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { UserPhotoDto } from 'src/user-photo/dto/user-photo.dto';
import { UserPhoto } from 'src/user-photo/entities/user-photo.entity';

export class ConversationProfileDto {
  @ApiProperty()
  user_id: number;

  @ApiProperty()
  full_name: string;

  @ApiProperty({ nullable: true })
  birthdate?: Date;

  @ApiProperty({ nullable: true })
  age?: number;

  @ApiProperty({ nullable: true, enum: ['male', 'female', 'other'] })
  gender?: string;

  @ApiProperty({ nullable: true })
  location?: Point;

  @ApiProperty({ nullable: true })
  bio?: string;

  @ApiProperty()
  is_online: boolean;

  @ApiProperty({ nullable: true })
  distance?: number;

  @ApiProperty({ nullable: true })
  last_active?: Date;

  @ApiProperty({ type: [UserPhoto], nullable: true })
  photos?: UserPhotoDto[];

  @ApiProperty({ type: [String], nullable: true })
  interests?: string[];

  // Privacy settings visibility flags
  @ApiProperty()
  show_photos: boolean;

  @ApiProperty()
  show_bio: boolean;

  @ApiProperty()
  show_age: boolean;

  @ApiProperty()
  show_interests: boolean;
}
