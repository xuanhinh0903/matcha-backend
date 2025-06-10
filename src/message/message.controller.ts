import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { TestMessageDto } from './dto/test-message.dto';
import { MessageService } from './message.service';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('test-send')
  @ApiOperation({ summary: 'Send a test message (Development only)' })
  async sendTestMessage(
    @Req() req: RequestWithUser,
    @Body() testMessageDto: TestMessageDto,
  ) {
    return this.messageService.sendTestMessage(req.user, testMessageDto);
  }

  @Post('upload-image/:conversationId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image for a message' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation',
    type: 'number',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadMessageImage(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messageService.uploadMessageImage(
      req.user,
      conversationId,
      file,
    );
  }

  @Get('conversation/:conversationId')
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation',
    type: 'number',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of messages per page',
    type: 'number',
    required: false,
  })
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('page') pageStr: string = '1',
    @Query('limit') limitStr: string = '20',
  ) {
    // Convert query params to numbers with fallback values
    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 20;

    return this.messageService.getMessages(
      req.user,
      conversationId,
      page,
      limit,
    );
  }

  @Get('conversation/:conversationId/media')
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation',
    type: 'number',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of media items per page',
    type: 'number',
    required: false,
  })
  async getConversationMedia(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('page') pageStr: string = '1',
    @Query('limit') limitStr: string = '20',
  ) {
    // Convert query params to numbers with fallback values
    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 20;

    return this.messageService.getConversationMedia(
      req.user,
      conversationId,
      page,
      limit,
    );
  }

  @Get('conversation/:conversationId/search')
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation',
    type: 'number',
  })
  @ApiQuery({
    name: 'query',
    description: 'Search query string',
    type: 'string',
    required: true,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    type: 'number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of messages per page',
    type: 'number',
    required: false,
  })
  async searchMessages(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query('query') query: string,
    @Query('page') pageStr: string = '1',
    @Query('limit') limitStr: string = '20',
  ) {
    // Convert query params to numbers with fallback values
    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 20;

    return this.messageService.searchMessages(
      req.user,
      conversationId,
      query,
      page,
      limit,
    );
  }

  @Get('conversations')
  async getConversations(@Req() req: RequestWithUser) {
    const result = await this.messageService.getConversations(req.user);
    // console.log('=>>>>>>>>>>>>> getConversations', result);
    return result;
  }

  @Delete('conversation/:conversationId')
  @ApiParam({
    name: 'conversationId',
    description: 'ID of the conversation to delete',
    type: 'number',
  })
  async deleteConversation(
    @Req() req: RequestWithUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    return this.messageService.deleteConversation(req.user, conversationId);
  }

  @Get('redis-adapter-status')
  @ApiOperation({
    summary: 'Check if Redis adapter is active (Development only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns Redis adapter status',
  })
  async checkRedisAdapterStatus() {
    return this.messageService.checkRedisAdapterStatus();
  }

  @Post('broadcast-test')
  @ApiOperation({
    summary: 'Broadcast a test message to all users (Development only)',
  })
  async broadcastTest(
    @Req() req: RequestWithUser,
    @Body() testMessageDto: { message: string },
  ) {
    return this.messageService.broadcastTestMessage(
      req.user,
      testMessageDto.message,
    );
  }

  @Get('redis-test')
  @ApiOperation({ summary: 'Test Redis adapter functionality (Dev only)' })
  @ApiResponse({ status: 200, description: 'Redis test endpoint info' })
  async testRedisAdapter() {
    return {
      message: 'Use WebSocket to test Redis adapter functionality',
      instructions: [
        '1. Connect to WebSocket at {baseUrl}/messages',
        '2. Send a "redis_test" event with payload: { message: "Your test message" }',
        '3. Listen for "redis_broadcast" events to receive broadcasts from other instances',
      ],
      example: {
        emit: {
          event: 'redis_test',
          payload: { message: 'Hello from Redis!' },
        },
        listen: {
          event: 'redis_broadcast',
        },
      },
    };
  }

  @Post('call/:userId')
  @ApiOperation({
    summary: 'Test call notification to a specific user (Development only)',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user to call' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        callType: {
          type: 'string',
          enum: ['audio', 'video'],
          description: 'Type of call to initiate',
          default: 'audio',
        },
      },
      required: [],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Test call notification sent',
  })
  async callNotification(
    @Req() req: RequestWithUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { callType?: 'audio' | 'video' },
  ) {
    return this.messageService.initiateCall(
      req.user,
      userId,
      body.callType || 'audio',
    );
  }
}
