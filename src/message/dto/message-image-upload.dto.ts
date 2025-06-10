import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class MessageImageUploadDto {
  @ApiProperty({
    description: 'ID of the conversation to upload the image to',
    example: 1,
  })
  @IsNumber()
  conversationId: number;
}
