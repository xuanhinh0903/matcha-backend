import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserBlockService } from './user-block.service';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';

@ApiTags('User Block')
@ApiBearerAuth()
@Controller('user-block')
@UseGuards(JwtGuard)
export class UserBlockController {
  constructor(private readonly userBlockService: UserBlockService) {}

  @Post(':blockedUserId')
  @ApiParam({
    name: 'blockedUserId',
    description: 'ID of the user to block',
    type: 'number',
  })
  async blockUser(
    @Req() req: RequestWithUser,
    @Param('blockedUserId') blockedUserId: number,
  ) {
    const userId = req.user.user_id; // Lấy userId từ JWT
    return this.userBlockService.blockUser(userId, blockedUserId);
  }

  @Delete(':blockedUserId')
  @ApiParam({
    name: 'blockedUserId',
    description: 'ID of the user to unblock',
    type: 'number',
  })
  async unblockUser(
    @Req() req: RequestWithUser,
    @Param('blockedUserId') blockedUserId: number,
  ) {
    const userId = req.user.user_id;
    return this.userBlockService.unblockUser(userId, blockedUserId);
  }

  //API: Lấy danh sách user đã block
  @Get()
  async getBlockedUsers(@Req() req: RequestWithUser) {
    const userId = req.user.user_id;
    return this.userBlockService.getBlockedUsers(userId);
  }
}
