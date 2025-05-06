import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiParam,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtGuard } from '../authentication/guards/jwt.guard';
import RequestWithUser from '../authentication/interfaces/requestWithUser.interface';
import { ConversationService } from './converstation.service';
import { ConversationProfileDto } from './dto/conversation-profile.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Conversation ID', type: 'number' })
  @ApiOkResponse({
    description: 'Get conversation details',
  })
  async getConversation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.conversationService.getConversationById(id, req.user);
  }

  @Get(':id/profile/:userId')
  @ApiParam({ name: 'id', description: 'Conversation ID', type: 'number' })
  @ApiParam({
    name: 'userId',
    description: 'User ID to get profile',
    type: 'number',
  })
  @ApiOkResponse({
    description: 'Get user profile in conversation with privacy settings',
    type: ConversationProfileDto,
  })
  async getConversationProfile(
    @Param('id', ParseIntPipe) conversationId: number,
    @Param('userId', ParseIntPipe) otherUserId: number,
    @Req() req: RequestWithUser,
  ): Promise<ConversationProfileDto> {
    return this.conversationService.getConversationProfile(
      conversationId,
      req.user.user_id,
      otherUserId,
    );
  }
}
