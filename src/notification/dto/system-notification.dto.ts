import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for sending system-wide notifications
 * @example
 * {
 *   "content": "New feature released: Profile Customization",
 *   "type": "system"
 * }
 */

export class SystemNotificationDto {
  @ApiProperty({
    description: 'The content of the notification message',
    example: 'New feature released: Profile Customization',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'The type of notification',
    example: 'system',
    enum: ['message', 'match', 'block', 'like', 'system'],
  })
  @IsString()
  @IsNotEmpty()
  type: string;
}
