import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../authentication/guards/jwt.guard';
import { NotificationService } from './notification.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SystemNotificationDto } from './dto/system-notification.dto';

interface AuthenticatedRequest extends Request {
  user: {
    user_id: number;
  };
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Request() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.notificationService.getNotifications(
      req.user.user_id,
      page,
      limit,
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: number,
  ) {
    return this.notificationService.markAsRead(req.user.user_id, id);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    return this.notificationService.markAllAsRead(req.user.user_id);
  }

  @Delete(':id')
  async deleteNotification(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: number,
  ) {
    console.log('Deleting notification with ID:', id);
    return this.notificationService.deleteNotification(req.user.user_id, id);
  }

  @Post('send-system-notification')
  @ApiBody({
    type: SystemNotificationDto,
    examples: {
      example1: {
        value: {
          content: 'New feature released: Profile Customization',
          type: 'system',
        },
        description: 'Send a system-wide notification',
      },
    },
  })
  async sendSystemNotification(
    @Body() notificationData: SystemNotificationDto,
  ) {
    return this.notificationService.sendSystemNotification(notificationData);
  }

  @Post('register-device')
  async registerDevice(
    @Request() req: AuthenticatedRequest,
    @Body() deviceData: RegisterDeviceDto,
  ) {
    return this.notificationService.registerDevice(
      req.user.user_id,
      deviceData.token,
      deviceData.platform,
    );
  }
}
