import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

type PrivacyLevel = 'private' | 'matches' | 'public';

export class PrivacySettingsDto {
  @ApiProperty({
    description: 'Privacy level for photos',
    enum: ['private', 'matches', 'public'],
    example: 'public',
  })
  @IsNotEmpty()
  @IsEnum(['private', 'matches', 'public'])
  photos: PrivacyLevel;

  @ApiProperty({
    description: 'Privacy level for bio',
    enum: ['private', 'matches', 'public'],
    example: 'public',
  })
  @IsNotEmpty()
  @IsEnum(['private', 'matches', 'public'])
  bio: PrivacyLevel;

  @ApiProperty({
    description: 'Privacy level for age',
    enum: ['private', 'matches', 'public'],
    example: 'matches',
  })
  @IsNotEmpty()
  @IsEnum(['private', 'matches', 'public'])
  age: PrivacyLevel;

  @ApiProperty({
    description: 'Privacy level for interests',
    enum: ['private', 'matches', 'public'],
    example: 'public',
  })
  @IsNotEmpty()
  @IsEnum(['private', 'matches', 'public'])
  interests: PrivacyLevel;

  // @ApiProperty({
  //   description: 'Privacy level for match statistics',
  //   enum: ['private', 'matches', 'public'],
  //   example: 'private',
  // })
  // @IsNotEmpty()
  // @IsEnum(['private', 'matches', 'public'])
  // matchStats: PrivacyLevel;
}
