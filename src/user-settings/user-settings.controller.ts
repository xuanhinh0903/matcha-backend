import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { UserSettingsService } from './user-settings.service';
import { PrivacySettingsDto } from './dto/privacy-settings.dto';

@ApiTags('User Settings')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get('privacy')
  @ApiOkResponse({
    description: 'Get user privacy settings',
    type: PrivacySettingsDto,
  })
  async getPrivacySettings(
    @Req() req: RequestWithUser,
  ): Promise<PrivacySettingsDto> {
    return this.userSettingsService.getPrivacySettings(req.user.user_id);
  }

  @Put('privacy')
  @ApiBody({ type: PrivacySettingsDto })
  @ApiOkResponse({
    description: 'Privacy settings updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Privacy settings updated successfully',
        },
      },
    },
  })
  async updatePrivacySettings(
    @Req() req: RequestWithUser,
    @Body() privacySettings: PrivacySettingsDto,
  ) {
    await this.userSettingsService.updatePrivacySettings(
      req.user.user_id,
      privacySettings,
    );
    return { message: 'Privacy settings updated successfully' };
  }
}
