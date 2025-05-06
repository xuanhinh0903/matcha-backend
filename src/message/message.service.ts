import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Message } from './message.entity';
import { Conversation } from '../converstation/converstation.entity';
import { UserBlockService } from '../user-block/user-block.service';
import { CloudinaryService } from 'src/utils/cloudinary/cloudinary.service';
import { TestMessageDto } from './dto/test-message.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { Server } from 'socket.io';
import { MessageGateway } from './message.gateway';

// Define Call interface for tracking active calls
interface Call {
  id: string;
  conversationId: number;
  callerId: number;
  receiverId: number;
  startTime: Date;
  endTime?: Date;
  status: 'ringing' | 'connected' | 'ended' | 'missed';
  type: 'audio' | 'video';
  lastActivity: Date;
}

@Injectable()
export class MessageService {
  private server: Server;
  // Remove the duplicate activeCalls map
  private messageGateway: MessageGateway;

  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private readonly userBlockService: UserBlockService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly userService: UserService,
  ) {}

  // Method to set the WebSocket server instance from the gateway
  setServer(server: Server) {
    this.server = server;
  }

  // Method to set MessageGateway reference
  setGateway(gateway: MessageGateway) {
    this.messageGateway = gateway;
  }

  async sendTestMessage(user: User, testMessageDto: TestMessageDto) {
    // Find or create conversation
    let conversation = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.user1', 'user1')
      .leftJoinAndSelect('conversation.user2', 'user2')
      .where(
        '(user1.user_id = :senderId AND user2.user_id = :receiverId) OR (user1.user_id = :receiverId AND user2.user_id = :senderId)',
        {
          senderId: user.user_id,
          receiverId: testMessageDto.receiverId,
        },
      )
      .getOne();

    if (!conversation) {
      conversation = this.conversationRepository.create({
        user1: { user_id: user.user_id },
        user2: { user_id: testMessageDto.receiverId },
      });
      await this.conversationRepository.save(conversation);
    }

    // Create and save message
    const message = this.messageRepository.create({
      conversation,
      sender: user,
      content: testMessageDto.content,
      content_type: testMessageDto.contentType,
      sent_at: new Date(),
    });

    await this.messageRepository.save(message);

    return {
      success: true,
      message: {
        message_id: message.message_id,
        conversation_id: conversation.conversation_id,
        sender: {
          user_id: user.user_id,
          full_name: user.full_name,
        },
        content: message.content,
        content_type: message.content_type,
        sent_at: message.sent_at,
      },
    };
  }

  async uploadMessageImage(
    user: User,
    conversationId: number,
    file: Express.Multer.File,
  ) {
    // Check if the conversation exists
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Check if user is part of conversation
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    // Check block status
    const isBlocked = await this.userBlockService.isBlockedBetween(
      conversation.user1.user_id,
      conversation.user2.user_id,
    );

    if (isBlocked) {
      return { error: 'Cannot upload images in a blocked conversation' };
    }

    try {
      // Upload the image to Cloudinary using the message folder
      const uploadResult = await this.cloudinaryService.uploadImage(
        file,
        process.env.CLOUDINARY_MESSAGE_FOLDER || 'message-images',
      );

      if (!uploadResult.originalUrl || !uploadResult.publicId) {
        throw new Error('Failed to upload image to Cloudinary');
      }

      // Return the image URLs for use in messages
      return {
        url: uploadResult.originalUrl,
        thumbnail_url: uploadResult.thumbnailUrl,
        public_id: uploadResult.publicId,
      };
    } catch (error) {
      console.error('Error uploading message image:', error);
      return { error: 'Failed to upload message image' };
    }
  }

  async getMessages(
    user: User,
    conversationId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Check if user is part of conversation
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    // Check block status
    const isBlocked = await this.userBlockService.isBlockedBetween(
      conversation.user1.user_id,
      conversation.user2.user_id,
    );

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversation: { conversation_id: conversationId } },
      relations: ['sender'],
      order: { sent_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      messages: messages.map((msg) => ({
        message_id: msg.message_id,
        sender: {
          user_id: msg.sender.user_id,
          full_name: msg.sender.full_name,
        },
        content: msg.content,
        content_type: msg.content_type,
        type: msg.type || 'normal',
        callType: msg.callType,
        callStatus: msg.callStatus,
        duration: msg.duration,
        sent_at: msg.sent_at,
        read_at: msg.read_at,
      })),
      isBlocked,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversationMedia(
    user: User,
    conversationId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Check if user is part of conversation
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    // Get only media messages (images, videos, gifs)
    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        conversation: { conversation_id: conversationId },
        content_type: In(['image', 'gif']), // Only get media types
      },
      relations: ['sender'],
      order: { sent_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      media: messages.map((msg) => ({
        message_id: msg.message_id,
        sender: {
          user_id: msg.sender.user_id,
          full_name: msg.sender.full_name,
        },
        content: msg.content,
        content_type: msg.content_type,
        sent_at: msg.sent_at,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchMessages(
    user: User,
    conversationId: number,
    query: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Check if user is part of conversation
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    // Check block status
    const isBlocked = await this.userBlockService.isBlockedBetween(
      conversation.user1.user_id,
      conversation.user2.user_id,
    );

    if (isBlocked) {
      return {
        messages: [] as any[],
        meta: { page, limit, total: 0, totalPages: 0 },
        isBlocked: true,
      };
    }

    try {
      const [messages, total] = await this.messageRepository
        .createQueryBuilder('message')
        .innerJoinAndSelect('message.conversation', 'conversation')
        .innerJoinAndSelect('message.sender', 'sender')
        .where('conversation.conversation_id = :conversationId', {
          conversationId,
        })
        .andWhere('message.content_type = :contentType', {
          contentType: 'text',
        }) // Only search text messages
        .andWhere('MATCH(message.content) AGAINST (:query IN BOOLEAN MODE)', {
          query: query
            .trim()
            .split(/\s+/)
            .map((term) => `+${term}*`)
            .join(' '),
        })
        .orderBy('message.sent_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        messages: messages.map((msg) => ({
          message_id: msg.message_id,
          conversation_id: conversationId,
          sender: {
            user_id: msg.sender.user_id,
            full_name: msg.sender.full_name,
          },
          content: msg.content,
          content_type: msg.content_type,
          sent_at: msg.sent_at,
          read_at: msg.read_at,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error searching messages:', error);

      // Fallback to LIKE search if fulltext search fails
      const [messages, total] = await this.messageRepository.findAndCount({
        where: {
          conversation: { conversation_id: conversationId },
          content_type: 'text',
          content: Like(`%${query}%`),
        },
        relations: ['sender'],
        order: { sent_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        messages: messages.map((msg) => ({
          message_id: msg.message_id,
          conversation_id: conversationId,
          sender: {
            user_id: msg.sender.user_id,
            full_name: msg.sender.full_name,
          },
          content: msg.content,
          content_type: msg.content_type,
          sent_at: msg.sent_at,
          read_at: msg.read_at,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  }

  async getConversations(user: User) {
    console.log('Fetching conversations for user:', user.user_id);

    try {
      // Single optimized query using JOIN to get conversations with last messages
      const conversations = await this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.user1', 'user1')
        .leftJoinAndSelect('conversation.user2', 'user2')
        .leftJoinAndSelect(
          'user1.photos',
          'user1_photos',
          'user1_photos.is_profile_picture = :isProfilePicture',
        )
        .leftJoinAndSelect(
          'user2.photos',
          'user2_photos',
          'user2_photos.is_profile_picture = :isProfilePicture',
        )
        .leftJoin(
          // Get the most recent message for each conversation
          (subQuery) => {
            return subQuery
              .select('MAX(m.message_id)', 'max_message_id')
              .addSelect('m.conversationConversationId', 'conversation_id')
              .from(Message, 'm')
              .groupBy('m.conversationConversationId');
          },
          'last_message',
          'last_message.conversation_id = conversation.conversation_id',
        )
        .leftJoinAndMapOne(
          'conversation.lastMessage',
          Message,
          'message',
          'message.message_id = last_message.max_message_id',
        )
        .leftJoinAndSelect('message.sender', 'message_sender')
        .where('user1.user_id = :userId OR user2.user_id = :userId', {
          userId: user.user_id,
          isProfilePicture: true,
        })
        .orderBy('message.sent_at', 'DESC') // Most recent conversations first
        .getMany();

      // Format response with minimal data
      const result = conversations.map((conv: any) => {
        const otherUser =
          conv.user1.user_id === user.user_id ? conv.user2 : conv.user1;

        return {
          conversation_id: conv.conversation_id,
          other_user: {
            user_id: otherUser.user_id,
            full_name: otherUser.full_name,
            photo_url: otherUser.photos[0]?.photo_url_thumbnail,
          },
          last_message: conv.lastMessage
            ? {
                content: conv.lastMessage.content,
                content_type: conv.lastMessage.content_type,
                sent_at: conv.lastMessage.sent_at,
              }
            : null,
        };
      });

      return result;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async deleteConversation(user: User, conversationId: number) {
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    // Check if user is part of conversation
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    // Delete all messages in the conversation first
    await this.messageRepository.delete({
      conversation: { conversation_id: conversationId },
    });

    // Delete the conversation
    await this.conversationRepository.delete(conversationId);

    return { success: true, message: 'Conversation deleted successfully' };
  }

  // Redis adapter test methods
  checkRedisAdapterStatus() {
    // Check if the MessageGateway has Redis adapter activated
    // Since we can't directly access gateway's private property, we'll use a different approach
    // Just return a response that the endpoint is available, testing will be done via WebSocket
    return {
      endpoint: 'available',
      instructions:
        'Use WebSocket client to send "redis_test" event with a message payload',
      example: {
        event: 'redis_test',
        payload: { message: 'Hello Redis!' },
      },
    };
  }

  async broadcastTestMessage(user: User, message: string) {
    // We'll implement a simple broadcast via websocket in a real app
    // This would typically use a direct reference to the WebSocket server
    // For now let's just return a success message
    return {
      status: 'success',
      message: 'To test the Redis adapter properly:',
      instructions: [
        '1. Connect two or more clients to the WebSocket',
        '2. Send "redis_test" event from one client with a message payload',
        '3. Other clients should receive a "redis_broadcast" event',
      ],
      user: {
        id: user.user_id,
        name: user.full_name,
      },
      testMessage: message,
    };
  }

  // New method to initiate calls via REST API
  async initiateCall(
    user: User,
    targetUserId: number,
    callType: 'audio' | 'video' = 'audio',
  ) {
    try {
      // Get the target user
      const targetUser = await this.userService.getById(targetUserId);

      if (!targetUser) {
        return { error: 'Target user not found' };
      }

      const conversation = await this.conversationRepository.findOne({
        where: [
          {
            user1: { user_id: user.user_id },
            user2: { user_id: targetUserId },
          },
          {
            user1: { user_id: targetUserId },
            user2: { user_id: user.user_id },
          },
        ],
      });

      if (!conversation) {
        return { error: 'Conversation does not exist' };
      }

      if (!this.server) {
        return { error: 'WebSocket server not initialized' };
      }

      const callId = `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Create a new call object
      const newCall: Call = {
        id: callId,
        conversationId: conversation.conversation_id,
        callerId: user.user_id,
        receiverId: targetUserId,
        startTime: new Date(),
        status: 'ringing',
        type: callType,
        lastActivity: new Date(),
      };

      // Store call in Gateway's memory instead of duplicating storage
      if (!this.messageGateway) {
        return { error: 'Message gateway not initialized' };
      }
      this.messageGateway.activeCalls.set(callId, newCall);

      // Prepare the call payload for the caller's UI
      const callInitiatedPayload = {
        callId,
        conversationId: conversation.conversation_id,
        callType,
        receiverId: targetUserId,
      };

      // Prepare the call payload for the receiver
      const callReceivedPayload = {
        callId,
        conversationId: conversation.conversation_id,
        callType,
        caller: {
          user_id: user.user_id,
          full_name: user.full_name,
          photo_url:
            user.photos?.find((photo) => photo.is_profile_picture)?.photo_url ||
            null,
        },
      };

      // Emit the call_received event to the receiver
      this.server
        .to(`user-${targetUserId}`)
        .emit('call_received', callReceivedPayload);

      return {
        success: true,
        message: `${callType.charAt(0).toUpperCase() + callType.slice(1)} call initiated to user ${targetUserId}`,
        callDetails: callInitiatedPayload,
      };
    } catch (error) {
      console.error('Error initiating call:', error);
      return { error: 'Failed to initiate call' };
    }
  }
}
