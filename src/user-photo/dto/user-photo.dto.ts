import { ApiProperty } from '@nestjs/swagger';

export class UserPhotoDto {
  @ApiProperty()
  photo_id: number;

  @ApiProperty()
  photo_url: string;

  @ApiProperty({ required: false })
  photo_url_thumbnail?: string;

  @ApiProperty()
  is_profile_picture: boolean;

  @ApiProperty()
  uploaded_at: Date;
}
