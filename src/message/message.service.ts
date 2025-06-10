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

// Add this interface for query results
interface ConversationQueryResult {
  conversation_id: string;
  other_user_id: string;
  other_user_name: string;
  message_id: string | null;
  content: string | null;
  content_type: string | null;
  sent_at: Date | null;
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    console.log(
      `Fetching messages for conversation ${conversationId}, page ${page}, limit ${limit}`,
    );

    try {
      // Check conversation access with a targeted query (faster than loading full entity)
      const conversationAccess = await this.conversationRepository
        .createQueryBuilder('c')
        .select('c.conversation_id')
        .addSelect('u1.user_id', 'user1Id')
        .addSelect('u2.user_id', 'user2Id')
        .innerJoin('c.user1', 'u1')
        .innerJoin('c.user2', 'u2')
        .where('c.conversation_id = :conversationId', { conversationId })
        .getRawOne();

      if (!conversationAccess) {
        return { error: 'Conversation not found' };
      }

      // Check if user is part of conversation (fast check using IDs)
      if (
        conversationAccess.user1Id !== user.user_id &&
        conversationAccess.user2Id !== user.user_id
      ) {
        return { error: 'Unauthorized' };
      }

      // Check block status with a more efficient query
      const otherUserId =
        conversationAccess.user1Id === user.user_id
          ? conversationAccess.user2Id
          : conversationAccess.user1Id;

      const isBlocked = await this.userBlockService.isBlockedBetween(
        conversationAccess.user1Id,
        conversationAccess.user2Id,
      );

      // Efficient optimized query for messages using index on conversation_id
      const [messages, total] = await this.messageRepository
        .createQueryBuilder('m')
        .select([
          'm.message_id',
          'm.content',
          'm.content_type',
          'm.sent_at',
          'm.read_at',
          'm.type',
          'm.callStatus',
          'm.callType',
          'm.duration',
          'sender.user_id',
          'sender.full_name',
        ])
        .innerJoin('m.sender', 'sender')
        .where('m.conversationConversationId = :conversationId', {
          conversationId,
        })
        .orderBy('m.sent_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      // Format response efficiently using the selected fields directly
      const formattedMessages = messages.map((msg) => ({
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
      }));

      // Mark unread messages as read if they were sent by the other user
      if (formattedMessages.length > 0) {
        await this.messageRepository
          .createQueryBuilder()
          .update(Message)
          .set({ read_at: new Date() })
          .where('conversationConversationId = :conversationId', {
            conversationId,
          })
          .andWhere('senderUserId = :otherUserId', { otherUserId })
          .andWhere('read_at IS NULL')
          .execute();
      }

      return {
        messages: formattedMessages,
        isBlocked,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
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

  async getConversations(user: User, page: number = 1, limit: number = 20) {
    console.log('Fetching conversations for user:', user.user_id);
    const startTime = Date.now();
    const performanceLog: Record<string, number> = {};

    try {
      // First, get all conversation IDs for this user
      const conversationsQueryStartTime = Date.now();
      const conversations = await this.conversationRepository
        .createQueryBuilder('c')
        .select('c.conversation_id', 'conversation_id')
        .addSelect(
          'CASE WHEN u1.user_id = :userId THEN u2.user_id ELSE u1.user_id END',
          'other_user_id',
        )
        .addSelect(
          'CASE WHEN u1.user_id = :userId THEN u2.full_name ELSE u1.full_name END',
          'other_user_name',
        )
        .innerJoin('c.user1', 'u1')
        .innerJoin('c.user2', 'u2')
        .where('u1.user_id = :userId OR u2.user_id = :userId', {
          userId: user.user_id,
        })
        .setParameter('userId', user.user_id)
        .getRawMany();
      performanceLog.conversationsQuery =
        Date.now() - conversationsQueryStartTime;

      if (conversations.length === 0) {
        return [];
      }

      // Create a map to track unique user pairs and their most recent conversation
      const processStartTime = Date.now();
      const uniqueUserPairsMap = new Map<
        number,
        {
          conversation_id: number;
          other_user_id: number;
          other_user_name: string;
        }
      >();

      // Process conversations to keep only the most recent one per user pair
      conversations.forEach((c) => {
        const otherUserId = parseInt(c.other_user_id);
        const conversationId = parseInt(c.conversation_id);

        if (
          !uniqueUserPairsMap.has(otherUserId) ||
          uniqueUserPairsMap.get(otherUserId)!.conversation_id < conversationId
        ) {
          uniqueUserPairsMap.set(otherUserId, {
            conversation_id: conversationId,
            other_user_id: otherUserId,
            other_user_name: c.other_user_name,
          });
        }
      });

      // Extract unique conversations
      const uniqueConversations = Array.from(uniqueUserPairsMap.values());

      // Get conversation IDs for these unique conversations
      const conversationIds = uniqueConversations.map((c) => c.conversation_id);
      performanceLog.processConversations = Date.now() - processStartTime;

      console.log(
        `Found ${conversations.length} total conversations, reduced to ${uniqueConversations.length} unique user pairs`,
      );

      // Use raw SQL for efficient latest messages query
      const messagesQueryStartTime = Date.now();
      // This approach uses a subquery to get the latest message per conversation
      const latestMessagesQuery = `
        WITH LatestMessages AS (
          SELECT m.*,
             ROW_NUMBER() OVER (PARTITION BY m."conversationConversationId" ORDER BY m.sent_at DESC) AS rn
          FROM message m
          WHERE m."conversationConversationId" IN (${conversationIds.join(',')})
        )
        SELECT * 
        FROM LatestMessages
        WHERE rn = 1
      `;

      const latestMessages =
        await this.messageRepository.query(latestMessagesQuery);
      performanceLog.messagesQuery = Date.now() - messagesQueryStartTime;

      // Create a map of conversation_id -> latest message
      const messageProcessStartTime = Date.now();
      const messageMap = new Map();
      latestMessages.forEach((m: any) => {
        messageMap.set(parseInt(m.conversationConversationId), {
          content: m.content,
          content_type: m.content_type,
          sent_at: m.sent_at,
        });
      });
      performanceLog.processMessages = Date.now() - messageProcessStartTime;

      // Get profile photos for the other users - OPTIMIZED QUERY
      // Only select the fields we need and use direct SQL query for better performance
      const otherUserIds = uniqueConversations.map((c) => c.other_user_id);

      // Optimize the photo query with correct column name (userUserId instead of user_id)
      const photoQueryStartTime = Date.now();
      // Use parameterized query for better security and performance
      const profilePhotosQuery = `
        SELECT u.user_id, p.photo_url_thumbnail 
        FROM "user" u
        LEFT JOIN "user_photo" p ON p."userUserId" = u.user_id AND p.is_profile_picture = true
        WHERE u.user_id IN (${otherUserIds.map((_, i) => `$${i + 1}`).join(',')})
      `;

      const userPhotos = await this.userRepository.query(
        profilePhotosQuery,
        otherUserIds,
      );

      performanceLog.photoQuery = Date.now() - photoQueryStartTime;

      // Create a map for profile photos
      const photoProcessStartTime = Date.now();
      const photoMap = new Map<number, string | null>();
      userPhotos.forEach((row: any) => {
        photoMap.set(parseInt(row.user_id), row.photo_url_thumbnail || null);
      });
      performanceLog.processPhotos = Date.now() - photoProcessStartTime;

      // Combine all data into the final result
      const resultBuildStartTime = Date.now();
      const result = uniqueConversations.map((c) => ({
        conversation_id: c.conversation_id,
        other_user: {
          user_id: c.other_user_id,
          full_name: c.other_user_name,
          photo_url: photoMap.get(c.other_user_id) || null,
        },
        last_message: messageMap.get(c.conversation_id) || null,
      }));

      // Sort by message timestamp (most recent first)
      result.sort((a, b) => {
        const timeA = a.last_message?.sent_at
          ? new Date(a.last_message.sent_at).getTime()
          : 0;
        const timeB = b.last_message?.sent_at
          ? new Date(b.last_message.sent_at).getTime()
          : 0;
        return timeB - timeA;
      });

      // Apply pagination after sorting
      const paginatedResult = result.slice((page - 1) * limit, page * limit);
      performanceLog.buildResult = Date.now() - resultBuildStartTime;

      // Log overall performance
      const totalTime = Date.now() - startTime;
      console.log(
        'Performance metrics (ms):',
        JSON.stringify(
          {
            total: totalTime,
            ...performanceLog,
            percentage: {
              conversationsQuery:
                Math.round(
                  (performanceLog.conversationsQuery / totalTime) * 100,
                ) + '%',
              messagesQuery:
                Math.round((performanceLog.messagesQuery / totalTime) * 100) +
                '%',
              photoQuery:
                Math.round((performanceLog.photoQuery / totalTime) * 100) + '%',
              other:
                Math.round(
                  ((totalTime -
                    performanceLog.conversationsQuery -
                    performanceLog.messagesQuery -
                    performanceLog.photoQuery) /
                    totalTime) *
                    100,
                ) + '%',
            },
          },
          null,
          2,
        ),
      );

      console.log(
        'Processing complete. Found:',
        result.length,
        'unique conversations, returning',
        paginatedResult.length,
      );

      return paginatedResult;
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
      console.log('user.user_id', user.user_id);
      // Get the target user
      const targetUser = await this.userService.getById(targetUserId);
      const userProfilePhoto = await this.userService.getProfilePhoto(
        user.user_id,
      );
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
          photo_url: userProfilePhoto,
        },
      };
      console.log('Call callReceivedPayload payload:', userProfilePhoto);

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
