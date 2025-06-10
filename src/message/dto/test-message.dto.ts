import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestMessageDto {
  @ApiProperty({ description: 'User ID of the message receiver' })
  @IsNumber()
  @IsNotEmpty()
  receiverId: number;

  @ApiProperty({ description: 'Content of the message' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Type of content',
    enum: ['text', 'emoji', 'sticker', 'image', 'gif'],
  })
  @IsEnum(['text', 'emoji', 'sticker', 'image', 'gif'])
  contentType: string;
}
