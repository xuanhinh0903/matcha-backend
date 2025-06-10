import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Conversation } from '../converstation/converstation.entity';
import { NotificationService } from '../notification/notification.service';
import { MessageService } from './message.service';
import { log } from 'console';

// Define the call types and interfaces
type CallType = 'audio' | 'video';
type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';

interface Call {
  id: string;
  conversationId: number;
  callerId: number;
  receiverId: number;
  startTime: Date;
  endTime?: Date;
  status: CallStatus;
  type: CallType;
  lastActivity: Date;
  _ringTimeoutReached?: boolean;
  _reconnectionAttempts?: number; // Track reconnection attempts
}

interface SignalingData {
  callId: string;
  conversationId: number;
  type: 'offer' | 'answer' | 'candidate' | 'hangup';
  sdp?: any;
  candidate?: any;
  senderUserId: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  // Use a dedicated namespace for messages
  namespace: 'messages',
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;
  private connectedUsers = new Map<number, Socket>();
  private _activeCalls = new Map<string, Call>();
  // Connection health check interval map
  private connectionHealthChecks = new Map<number, NodeJS.Timeout>();
  // Auto cleanup timeouts for calls that might be left hanging
  private callTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private notificationService: NotificationService,
    private messageService: MessageService,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
    // Pass the server instance to the MessageService
    this.messageService.setServer(server);
    // Pass the gateway reference to the MessageService
    this.messageService.setGateway(this);

    // Set up an interval to clean up stale calls every 5 minutes
    setInterval(() => this.cleanupStaleCalls(), 5 * 60 * 1000);
  }

  // Public getter for the activeCalls map
  get activeCalls() {
    return this._activeCalls;
  }

  async handleConnection(client: Socket) {
    if (client.data.processed) {
      console.log('Socket already processed, skipping:', client.id);
      return;
    }
    client.data.processed = true;

    const token = client.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      client.emit('auth_error', {
        type: 'missing_token',
        message: 'Authentication token is missing',
      });
      client.disconnect();
      return;
    }

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userService.getById(decoded.userId);

      if (!user) {
        console.log('Not user and disconnect');
        client.emit('auth_error', {
          type: 'user_not_found',
          message: 'User not found',
        });
        client.disconnect();
        return;
      }

      // Store user in client.data for future reference
      client.data.user = user;

      // Check if this user already has an active connection
      const existingSocket = this.connectedUsers.get(user.user_id);
      if (existingSocket && existingSocket.id !== client.id) {
        console.log(
          `User ${user.user_id} already connected with socket ${existingSocket.id}, replacing with new socket ${client.id}`,
        );

        // Instead of disconnecting the older socket, just replace it in the connectedUsers map
        // This prevents interruption of the current session
        this.connectedUsers.set(user.user_id, client);

        // Notify the old socket that it's being replaced, but don't disconnect it
        // This allows ongoing calls to continue properly
        existingSocket.emit('duplicate_connection', {
          message: 'You connected from another device or tab',
          newSocketId: client.id,
          action: 'replaced',
        });
      } else {
        // Set this socket as the user's active connection if no existing connection
        this.connectedUsers.set(user.user_id, client);
      }

      // Join personal room first
      client.join(`user-${user.user_id}`);

      // Emit user_status_changed event to all clients
      this.server.emit('user_status_changed', {
        user_id: user.user_id,
        is_online: true,
      });

      // Use more efficient query to get just conversation IDs instead of loading all data
      const conversations = await this.conversationRepository
        .createQueryBuilder('conversation')
        .select('conversation.conversation_id')
        .where('conversation.user1 = :userId', { userId: user.user_id })
        .orWhere('conversation.user2 = :userId', { userId: user.user_id })
        .getMany();

      const conversationIds = conversations.map((c) => c.conversation_id);

      // Join rooms in a non-blocking way
      for (const id of conversationIds) {
        const room = `conversation-${id}`;
        client.join(room);
      }

      console.log(
        `User ${user.user_id} connected with socket ${client.id}, joined ${conversationIds.length} rooms`,
      );

      // Send immediate ping-pong to establish connection quality
      client.emit('ping', Date.now(), (latency: number) => {
        console.log(
          `Initial connection latency for ${user.user_id}: ${latency}ms`,
        );
      });

      // Start connection health check
      this.startConnectionHealthCheck(user.user_id, client);
    } catch (error) {
      // Handle token expiration specifically
      if (error.name === 'TokenExpiredError') {
        console.log(
          'Token expired for socket:',
          client.id,
          'Expiry:',
          error.expiredAt,
        );
        // Emit a specific event to inform the client about token expiration
        client.emit('auth_error', {
          type: 'token_expired',
          message: 'Authentication token has expired',
          expiredAt: error.expiredAt,
        });
        client.disconnect();
      } else {
        // Handle other connection errors
        console.error('Connection error:', error);
        client.emit('auth_error', {
          type: 'auth_failed',
          message: 'Authentication failed',
        });
        client.disconnect();
      }
    }
  }

  handleDisconnect(client: Socket) {
    console.log('handleDisconnect');
    if (client.data.user) {
      const userId = client.data.user.user_id;
      this.connectedUsers.delete(userId);

      this.cleanupConnectionHealthCheck(userId);

      // Emit user_status_changed event to notify all clients that user is offline
      this.server.emit('user_status_changed', {
        user_id: userId,
        is_online: false,
      });
    }
  }

  private async storeCallRecord(call: Call) {
    try {
      console.log('storeCallRecord', call);
      // Create a call message to store in the conversation
      const conversation = await this.conversationRepository.findOne({
        where: { conversation_id: call.conversationId },
        relations: ['user1', 'user2'],
      });

      if (!conversation) {
        console.error(
          `Error storing call record: Conversation ${call.conversationId} not found`,
        );
        return;
      }

      // Only store completed calls
      if (
        call.status === 'ended' ||
        call.status === 'rejected' ||
        call.status === 'missed'
      ) {
        const callDuration = call.endTime
          ? Math.floor(
              (call.endTime.getTime() - call.startTime.getTime()) / 1000,
            )
          : 0;

        // Format message content based on call status and duration
        let statusText = '';
        if (call.status === 'ended' && callDuration > 0) {
          // Format duration with minutes and seconds properly
          const minutes = Math.floor(callDuration / 60);
          const seconds = callDuration % 60;
          statusText = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else if (call.status === 'rejected') {
          statusText = 'Call declined';
        } else if (call.status === 'missed') {
          statusText = 'Missed call';
        } else {
          statusText = 'Call ended';
        }

        const message = this.messageRepository.create({
          conversation,
          sender: { user_id: call.callerId },
          content: `${call.type === 'video' ? 'Video' : 'Audio'} call. ${statusText}`,
          content_type: 'text',
          type: 'call',
          callType: call.type,
          callStatus: call.status,
          duration: callDuration,
          sent_at: call.startTime,
        });

        console.log(
          `Logging call record: ${call.id}, type: ${call.type}, status: ${call.status}, duration: ${callDuration}s`,
        );

        try {
          const savedMessage = await this.messageRepository.save(message);
          console.log(
            `Call record saved successfully with message ID: ${savedMessage.message_id}`,
          );
          return savedMessage;
        } catch (dbError) {
          console.error('Database error saving call record:', dbError);
        }
      } else {
        console.log(
          `Not storing call with status ${call.status} - not a completed call`,
        );
      }
    } catch (error) {
      console.error('Error in storeCallRecord:', error);
    }
  }

  private cleanupStaleCalls() {
    const now = new Date();
    for (const [callId, call] of this._activeCalls.entries()) {
      // If a call has been ringing for more than 30 seconds with no activity, mark as missed
      if (
        call.status === 'ringing' &&
        now.getTime() - call.lastActivity.getTime() > 30000
      ) {
        call.status = 'missed';
        call.endTime = now;

        // Notify both parties
        this.server.to(`user-${call.callerId}`).emit('call_missed', {
          callId,
          conversationId: call.conversationId,
        });

        // Store call record
        this.storeCallRecord(call);
        this._activeCalls.delete(callId);
      }

      // If a call has ended more than 5 minutes ago, remove it from memory
      if (
        (call.status === 'ended' ||
          call.status === 'rejected' ||
          call.status === 'missed') &&
        call.endTime &&
        now.getTime() - call.endTime.getTime() > 300000
      ) {
        this._activeCalls.delete(callId);
        this.connectedUsers.delete(call.callerId);
      }
    }
  }

  // CALL HANDLING - NEW IMPLEMENTATION

  @SubscribeMessage('call_start')
  async handleCallStart(
    client: Socket,
    payload: {
      conversationId: number;
      callType: CallType;
    },
  ) {
    const { conversationId, callType } = payload;
    const caller = client.data.user;

    if (!caller) {
      return { error: 'User not authenticated' };
    }

    try {
      // Check if conversation exists
      const conversation = await this.conversationRepository.findOne({
        where: { conversation_id: conversationId },
        relations: ['user1', 'user2'],
      });

      if (!conversation) {
        return { error: 'Conversation not found' };
      }

      // Check if the caller is part of this conversation
      if (
        conversation.user1.user_id !== caller.user_id &&
        conversation.user2.user_id !== caller.user_id
      ) {
        return { error: 'You are not part of this conversation' };
      }

      // Determine the receiver
      const receiverId =
        conversation.user1.user_id === caller.user_id
          ? conversation.user2.user_id
          : conversation.user1.user_id;

      // Check if there's already an active call in this conversation
      for (const [_, existingCall] of this._activeCalls.entries()) {
        if (
          existingCall.conversationId === conversationId &&
          (existingCall.status === 'ringing' ||
            existingCall.status === 'connected')
        ) {
          return { error: 'Call already in progress in this conversation' };
        }
      }

      // Create a new call object
      const callId = `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const newCall: Call = {
        id: callId,
        conversationId,
        callerId: caller.user_id,
        receiverId,
        startTime: new Date(),
        status: 'ringing',
        type: callType,
        lastActivity: new Date(),
      };

      // Store call in memory
      this._activeCalls.set(callId, newCall);

      // Set up a timeout to automatically end the call if not answered
      this.callTimeouts.set(
        callId,
        setTimeout(() => {
          const call = this._activeCalls.get(callId);
          if (call && call.status === 'ringing') {
            // Instead of immediately marking as missed, mark as "timeout" status first
            // and give a grace period for potential late answers
            console.log(
              `Call ${callId} ring timeout reached, marking as pending missed`,
            );

            // Set an internal property to track that it timed out, but don't change status yet
            // This allows the call to still be answered for a grace period
            call['_ringTimeoutReached'] = true;

            // Set another timeout for actual missed call status after grace period
            setTimeout(() => {
              // Only proceed if call still exists and is in ringing status
              const currentCall = this._activeCalls.get(callId);
              if (currentCall && currentCall.status === 'ringing') {
                console.log(
                  `Call ${callId} grace period expired, marking as missed`,
                );
                currentCall.status = 'missed';
                currentCall.endTime = new Date();

                // Notify the caller
                this.server
                  .to(`user-${currentCall.callerId}`)
                  .emit('call_missed', {
                    callId,
                    conversationId: currentCall.conversationId,
                  });

                console.log('Call missed', currentCall);
                // Store call record
                this.storeCallRecord(currentCall);

                this._activeCalls.delete(callId);
              }
            }, 10000); // 10 second grace period after timeout
          }
        }, 30000),
      );

      // Emit call_initiated to the caller for confirmation
      client.emit('call_initiated', {
        callId,
        conversationId,
        callType,
        receiverId,
      });

      // Check if receiver is online
      const isReceiverOnline = this.connectedUsers.has(receiverId);

      if (isReceiverOnline) {
        console.log(
          'isReceiverOnline Called  this.emitIncomingCall(callId, newCall);',
        );
        // Emit call_received to the receiver
        // this.emitIncomingCall(callId, newCall);
      } else {
        // Send a push notification to the offline user
        const receiver = await this.userService.getById(receiverId);
        if (receiver) {
          const notificationContent = `${caller.full_name} is ${callType === 'video' ? 'video' : ''} calling you`;
          await this.notificationService.createNotification(
            receiver,
            'call',
            notificationContent,
            {
              callId,
              conversationId,
              callType,
              callerId: caller.user_id,
              callerName: caller.full_name,
            },
          );
        }
      }

      return {
        success: true,
        callId,
      };
    } catch (error) {
      console.error('Error initializing call:', error);
      return { error: 'Failed to initialize call' };
    }
  }

  @SubscribeMessage('call_answer')
  async handleCallAnswer(client: Socket, payload: { callId: string }) {
    const { callId } = payload;
    // const user = client.data.user;
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Only the receiver can answer the call
    if (call.receiverId !== user.user_id) {
      return { error: 'You cannot answer this call' };
    }

    // Only answer if call is still ringing
    if (call.status !== 'ringing') {
      // Special case: If the call is "ended" or "missed" but was recently timeout reached
      // (within the grace period), we still allow answering it
      if (
        (call.status === 'missed' || call['_ringTimeoutReached']) &&
        call.endTime &&
        Date.now() - call.endTime.getTime() < 15000
      ) {
        // 15 second grace period

        console.log(
          `Call ${callId} being answered during grace period, restoring status`,
        );
        // Restore the call to 'ringing' status first
        delete call['_ringTimeoutReached'];
        delete call.endTime;
      } else {
        // Normal case, call cannot be answered
        return { error: `Call cannot be answered (status: ${call.status})` };
      }
    }

    // Update call status
    call.status = 'connected';
    // Reset the start time to when the call was actually connected rather than initiated
    // This ensures accurate call duration calculation
    call.startTime = new Date();
    call.lastActivity = new Date();

    // Clear the timeout since call was answered
    if (this.callTimeouts.has(callId)) {
      clearTimeout(this.callTimeouts.get(callId));
      this.callTimeouts.delete(callId);
    }

    // Notify the caller that call was answered
    this.server.to(`user-${call.callerId}`).emit('call_answered', {
      callId,
      conversationId: call.conversationId,
    });

    return { success: true };
  }

  @SubscribeMessage('call_reject')
  async handleCallReject(client: Socket, payload: { callId: string }) {
    const { callId } = payload;
    // const user = client.data.user;
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Only the receiver can reject the call
    if (call.receiverId !== user.user_id) {
      return { error: 'You cannot reject this call' };
    }

    // Only reject if call is still ringing
    if (call.status !== 'ringing') {
      return { error: `Call cannot be rejected (status: ${call.status})` };
    }

    // Update call status
    call.status = 'rejected';
    call.endTime = new Date();
    call.lastActivity = new Date();

    // Clear any timeout
    if (this.callTimeouts.has(callId)) {
      clearTimeout(this.callTimeouts.get(callId));
      this.callTimeouts.delete(callId);
    }

    // Notify the caller that call was rejected
    this.server.to(`user-${call.callerId}`).emit('call_rejected', {
      callId,
      conversationId: call.conversationId,
    });

    console.log('Call rejected', call);
    // Store call record
    await this.storeCallRecord(call);

    this._activeCalls.delete(callId);

    return { success: true };
  }

  @SubscribeMessage('call_end')
  async handleCallEnd(client: Socket, payload: { callId: string }) {
    const { callId } = payload;
    console.log('handleCallEnd', payload);
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      console.log(
        `Call ${callId} not found when attempting to end it. This may be a duplicate event.`,
      );
      return { error: 'Call not found' };
    }

    // Only participants can end the call
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      return { error: 'You cannot end this call' };
    }

    console.log(
      `Call ${callId} ending by user ${user.user_id}, current status: ${call.status}`,
    );

    // If call is already ended, don't process it again to prevent duplicate events
    if (call.status === 'ended') {
      console.log(
        `Call ${callId} already ended, ignoring duplicate end request`,
      );
      return { success: true, alreadyEnded: true };
    }

    // Determine if this is a call cancellation (caller ends a ringing call) BEFORE changing status
    const initialCallStatus = call.status;
    const isCallCancellation =
      user.user_id === call.callerId && initialCallStatus === 'ringing';

    // Update call status
    call.status = 'ended';
    call.endTime = new Date();
    call.lastActivity = new Date();

    // Clear any timeout
    if (this.callTimeouts.has(callId)) {
      clearTimeout(this.callTimeouts.get(callId));
      this.callTimeouts.delete(callId);
    }

    // Calculate call duration in seconds
    const durationSeconds = Math.floor(
      (call.endTime.getTime() - call.startTime.getTime()) / 1000,
    );

    console.log(
      `Call ${callId} ended. Type: ${call.type}, Duration: ${durationSeconds}s, Start time: ${call.startTime.toISOString()}, End time: ${call.endTime.toISOString()}`,
    );

    // Get the other participant's ID
    const otherUserId =
      call.callerId === user.user_id ? call.receiverId : call.callerId;

    // Send appropriate event based on whether it's a cancellation or regular end
    if (isCallCancellation) {
      console.log(
        `Call ${callId} was cancelled by the caller. Notifying recipient ${otherUserId}`,
      );
      this.server.to(`user-${otherUserId}`).emit('call_cancelled', {
        callId,
        conversationId: call.conversationId,
        cancelledBy: user.user_id,
        callType: call.type,
      });
    } else {
      // Regular call end
      this.server.to(`user-${otherUserId}`).emit('call_ended', {
        callId,
        conversationId: call.conversationId,
        duration: durationSeconds,
        endedBy: user.user_id,
        callType: call.type,
      });
    }

    try {
      // Store call record and wait for it to complete
      console.log(`Storing call record for call ${callId}`);
      console.log('Call details:', call);
      const storedMessage = await this.storeCallRecord(call);

      if (storedMessage) {
        console.log(
          `Call ${callId} stored successfully as message ${storedMessage.message_id}`,
        );

        // Notify both users to refresh their message list
        this.server.to(`user-${call.callerId}`).emit('refresh_messages', {
          conversationId: call.conversationId,
        });

        this.server.to(`user-${call.receiverId}`).emit('refresh_messages', {
          conversationId: call.conversationId,
        });
      } else {
        console.warn(`Call ${callId} record may not have been properly stored`);
      }
    } catch (error) {
      console.error(`Error storing call record for ${callId}:`, error);
    } finally {
      // Remove from active calls only after storage attempt is complete
      this._activeCalls.delete(callId);
    }

    return {
      success: true,
      duration: durationSeconds,
      callType: call.type,
    };
  }

  @SubscribeMessage('call_end_accepted')
  async handleCallEndAccepted(
    client: Socket,
    payload: {
      callId: string;
      duration: number;
      conversationId: number;
      callType: CallType;
    },
  ) {
    const { callId, duration } = payload;
    console.log('handleCallEndAccepted', payload);
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    // For accepted calls, we may want to log the call even if it's not in active calls anymore
    if (!call) {
      console.log(
        `Call ${callId} not found in active calls. Creating temporary record for logging.`,
      );

      // Try to extract conversation ID from payload if available
      const conversationId = payload.hasOwnProperty('conversationId')
        ? payload.conversationId
        : null;

      if (!conversationId) {
        return { error: 'Call not found and no conversation ID provided' };
      }

      // Create temporary call record for logging
      const tempCall: Call = {
        id: callId,
        conversationId: conversationId,
        callerId: user.user_id, // Assuming the person ending the call is the caller
        receiverId: 0, // Will be updated below
        startTime: new Date(Date.now() - duration * 1000), // Calculate start time based on duration
        endTime: new Date(),
        status: 'ended',
        type: payload.hasOwnProperty('callType') ? payload.callType : 'audio',
        lastActivity: new Date(),
      };

      // Get the conversation to find the other user
      try {
        const conversation = await this.conversationRepository.findOne({
          where: { conversation_id: conversationId },
          relations: ['user1', 'user2'],
        });

        if (conversation) {
          // Set the receiver ID based on the conversation
          tempCall.receiverId =
            conversation.user1.user_id === user.user_id
              ? conversation.user2.user_id
              : conversation.user1.user_id;

          // Store the call record
          // await this.storeCallRecord(tempCall);

          return {
            success: true,
            message: 'Call logged successfully with reconstructed data',
          };
        } else {
          return { error: 'Conversation not found' };
        }
      } catch (error) {
        console.error(
          'Error finding conversation or storing call record:',
          error,
        );
        return { error: 'Failed to log call' };
      }
    }

    // Only participants can end the call
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      return { error: 'You cannot end this call' };
    }

    console.log(
      `Call ${callId} ending accepted call by user ${user.user_id}, current status: ${call.status}, duration: ${duration}s`,
    );

    // If call is already ended, don't process it again to prevent duplicate events
    if (call.status === 'ended') {
      console.log(
        `Call ${callId} already ended, ignoring duplicate end request`,
      );
      return { success: true, alreadyEnded: true };
    }

    // Update call status
    call.status = 'ended';
    call.endTime = new Date();
    call.lastActivity = new Date();

    // Use the provided duration if available, otherwise calculate it
    const durationSeconds =
      duration ||
      Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);

    console.log(
      `Accepted call ${callId} ended. Type: ${call.type}, Duration: ${durationSeconds}s, Start time: ${call.startTime.toISOString()}, End time: ${call.endTime.toISOString()}`,
    );

    // Get the other participant's ID
    const otherUserId =
      call.callerId === user.user_id ? call.receiverId : call.callerId;

    // Regular call end notification
    this.server.to(`user-${otherUserId}`).emit('call_ended', {
      callId,
      conversationId: call.conversationId,
      duration: durationSeconds,
      endedBy: user.user_id,
      callType: call.type,
    });

    try {
      // Store call record and wait for it to complete
      console.log(`Storing accepted call record for call ${callId}`);
      console.log('Call details:', call);
      const storedMessage = await this.storeCallRecord(call);

      if (storedMessage) {
        console.log(
          `Call ${callId} stored successfully as message ${storedMessage.message_id}`,
        );

        // Notify both users to refresh their message list
        this.server.to(`user-${call.callerId}`).emit('refresh_messages', {
          conversationId: call.conversationId,
        });

        this.server.to(`user-${call.receiverId}`).emit('refresh_messages', {
          conversationId: call.conversationId,
        });
      } else {
        console.warn(`Call ${callId} record may not have been properly stored`);
      }
    } catch (error) {
      console.error(`Error storing call record for ${callId}:`, error);
    } finally {
      // Remove from active calls only after storage attempt is complete
      this._activeCalls.delete(callId);
    }

    return {
      success: true,
      duration: durationSeconds,
      callType: call.type,
    };
  }

  @SubscribeMessage('webrtc_signal')
  async handleWebRTCSignal(
    client: Socket,
    payload: {
      callId: string;
      signal: any;
    },
  ) {
    const { callId, signal } = payload;
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Only participants can send signals
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      return { error: 'You cannot send signals for this call' };
    }

    // Validate the signal structure based on its type
    if (!signal || !signal.type) {
      return { error: 'Invalid signal: missing type' };
    }

    // Validate based on signal type
    if (signal.type === 'offer' || signal.type === 'answer') {
      if (!signal.sdp) {
        return { error: `Invalid ${signal.type}: missing sdp` };
      }
    } else if (signal.type === 'candidate') {
      if (!signal.candidate) {
        return { error: 'Invalid ICE candidate: missing candidate data' };
      }
    } else {
      return { error: `Unsupported signal type: ${signal.type}` };
    }

    // Determine the recipient
    const recipientId =
      call.callerId === user.user_id ? call.receiverId : call.callerId;

    // Forward the signal to the other participant
    this.server.to(`user-${recipientId}`).emit('webrtc_signal', {
      callId,
      fromUserId: user.user_id,
      signal,
    });

    // Update last activity timestamp
    call.lastActivity = new Date();

    return { success: true };
  }

  // Handle connecting to an existing call
  @SubscribeMessage('call_connect')
  async handleCallConnect(client: Socket, payload: { callId: string }) {
    const token = client.handshake.headers.authorization?.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    const user = await this.userService.getById(decoded.userId);

    const { callId } = payload;

    if (!user) {
      console.log('handleCallConnect: User not authenticated');
      return { error: 'User not authenticated' };
    }

    // Create a local deep copy of the call to prevent any concurrent modifications
    const call = this._activeCalls.get(callId);
    console.log(
      `handleCallConnect: Initial call state - callId: ${callId}, status: ${call?.status}`,
    );

    if (!call) {
      console.log(`handleCallConnect: Call ${callId} not found`);
      return { error: 'Call not found' };
    }

    // Check if the user is a participant in this call
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      console.log(
        `handleCallConnect: User ${user.user_id} is not a participant in call ${callId}`,
      );
      return { error: 'You are not a participant in this call' };
    }

    // Update last activity time
    call.lastActivity = new Date();
    console.log(
      `handleCallConnect: After update - callId: ${callId}, status: ${call.status}`,
    );

    // If the call was missed or ended but the receiver is connecting, change status to ringing
    if (
      ['missed', 'ended'].includes(call.status) &&
      user.user_id === call.receiverId
    ) {
      console.log(
        `handleCallConnect: Changing call ${callId} status from ${call.status} to ringing`,
      );
      call.status = 'ringing';
      delete call.endTime; // Remove end time since we're reactivating the call

      // Clear any existing timeout
      if (this.callTimeouts.has(callId)) {
        clearTimeout(this.callTimeouts.get(callId));
        this.callTimeouts.delete(callId);
        console.log(
          `handleCallConnect: Cleared existing timeout for call ${callId}`,
        );
      }

      // Notify the caller that the call is now ringing again
      this.server.to(`user-${call.callerId}`).emit('call_ringing', {
        callId,
        conversationId: call.conversationId,
      });

      // Set a new timeout
      this.callTimeouts.set(
        callId,
        setTimeout(() => {
          const currentCall = this._activeCalls.get(callId);
          if (currentCall && currentCall.status === 'ringing') {
            console.log(
              `Call ${callId} ring timeout reached, marking as missed`,
            );
            currentCall.status = 'missed';
            currentCall.endTime = new Date();

            // Notify the caller
            this.server.to(`user-${currentCall.callerId}`).emit('call_missed', {
              callId,
              conversationId: currentCall.conversationId,
            });
            console.log('Call missed in 896', currentCall);
            // Store the call record
            this.storeCallRecord(currentCall);

            // Clean up after a delay
            this._activeCalls.delete(callId);
          }
        }, 30000),
      );
    }

    console.log(
      `handleCallConnect: Final call status: ${call.status}, returning to client`,
    );
    return {
      success: true,
      callDetails: {
        callId,
        conversationId: call.conversationId,
        callStatus: call.status,
        callType: call.type,
        isOutgoing: user.user_id === call.callerId,
      },
    };
  }

  @SubscribeMessage('call_status')
  async handleCallStatus(client: Socket, payload: { callId: string }) {
    const { callId } = payload;
    const user = client.data.user;

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Check if the user is a participant in this call
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      return { error: 'You are not a participant in this call' };
    }

    // Return current call status
    return {
      callId,
      conversationId: call.conversationId,
      status: call.status,
      type: call.type,
      startTime: call.startTime,
      isOutgoing: call.callerId === user.user_id,
    };
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    client: Socket,
    payload: { conversationId: number; content: string; contentType: string },
  ) {
    const { conversationId, content, contentType } = payload;
    const user = client.data.user;

    if (!conversationId || !content) {
      return { error: 'Invalid message payload' };
    }

    if (content.length > 1000) {
      return { error: 'Message too long (max 1000 characters)' };
    }

    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['user1', 'user2'],
    });
    if (!conversation) {
      return { error: 'Conversation not found' };
    }
    if (
      conversation.user1.user_id !== user.user_id &&
      conversation.user2.user_id !== user.user_id
    ) {
      return { error: 'Unauthorized' };
    }

    const message = this.messageRepository.create({
      conversation,
      sender: user,
      content,
      content_type: contentType,
      sent_at: new Date(),
    });

    try {
      const savedMessage = await this.messageRepository.save(message);

      // Add a unique identifier to the message payload
      const messagePayload = {
        message_id: savedMessage.message_id,
        conversation_id: conversationId,
        sender: {
          user_id: user.user_id,
          full_name: user.full_name,
          photo_url: user.photo_url,
        },
        content,
        content_type: contentType,
        sent_at: savedMessage.sent_at,
      };

      // Determine recipient user
      const recipientUser =
        conversation.user1.user_id === user.user_id
          ? conversation.user2
          : conversation.user1;

      // Check if recipient is connected/active
      const isRecipientActive = this.connectedUsers.has(recipientUser.user_id);
      console.log(
        `Recipient ${recipientUser.user_id} is active: ${isRecipientActive}`,
      );

      // Broadcast the new message to all clients in the conversation except the sender
      client.broadcast
        .to(`conversation-${conversationId}`)
        .emit('new_message', messagePayload);

      // Ensure the message is only sent once to avoid duplicates
      console.log(`Broadcasted message ID: ${savedMessage.message_id}`);

      // If recipient is not active, send push notification and create notification record
      if (!isRecipientActive) {
        // Format notification content
        let notificationContent: string;
        if (contentType === 'text') {
          // For text messages, include a snippet of the message
          const previewLength = Math.min(content.length, 50); // Limit to 50 chars
          notificationContent = `${user.full_name}: ${content.substring(0, previewLength)}${content.length > previewLength ? '...' : ''}`;
        } else if (contentType === 'image') {
          notificationContent = `${user.full_name} sent you an image`;
        } else {
          notificationContent = `New message from ${user.full_name}`;
        }

        console.log(
          `Sending notification to user ${recipientUser.user_id}: "${notificationContent}"`,
        );

        try {
          // Create notification and send push notification with message_id to avoid duplication
          await this.notificationService.createNotification(
            recipientUser,
            'message',
            notificationContent,
            // Add message details to notification data to prevent duplication
            {
              conversation_id: conversationId,
              message_id: savedMessage.message_id,
              sender_id: user.user_id,
              sender_name: user.full_name,
            },
          );
          console.log('Notification sent successfully with message reference');
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }

      return { success: true, message: messagePayload };
    } catch (dbError) {
      console.error('Database error saving message:', dbError);
      return { error: 'Failed to save message' };
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(client: Socket, payload: { messageId: number }) {
    const { messageId } = payload;
    const user = client.data.user;
    const message = await this.messageRepository.findOne({
      where: { message_id: messageId },
      relations: ['conversation', 'conversation.user1', 'conversation.user2'],
    });
    if (!message) {
      return { error: 'Message not found' };
    }
    const isRecipient =
      (message.conversation.user1.user_id === user.user_id &&
        message.sender.user_id !== user.user_id) ||
      (message.conversation.user2.user_id === user.user_id &&
        message.sender.user_id !== user.user_id);
    if (!isRecipient) {
      return { error: 'Unauthorized' };
    }
    message.read_at = new Date();
    await this.messageRepository.save(message);
    this.server
      .to(`conversation-${message.conversation.conversation_id}`)
      .emit('message_read', {
        message_id: messageId,
        read_at: message.read_at,
      });
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, timestamp: number) {
    const latency = Date.now() - timestamp;
    // Return the latency to the client
    return latency;
  }

  @SubscribeMessage('connection_status')
  handleConnectionStatus(client: Socket) {
    // Send back current status
    return { connected: true, timestamp: Date.now() };
  }

  startConnectionHealthCheck(userId: number, client: Socket) {
    // Clear any existing interval for this user
    if (this.connectionHealthChecks.has(userId)) {
      clearInterval(this.connectionHealthChecks.get(userId));
    }

    // Create new interval to check connection health every 30 seconds
    const interval = setInterval(() => {
      if (!client.connected) {
        console.log(`Client ${userId} disconnected, clearing health check`);
        clearInterval(interval);
        this.connectionHealthChecks.delete(userId);
        return;
      }

      try {
        client.emit(
          'connection_check',
          { timestamp: Date.now() },
          (response: any) => {
            if (!response) {
              console.log(`Connection health check failed for user ${userId}`);
            }
          },
        );
      } catch (error) {
        console.error(
          `Error in connection health check for user ${userId}:`,
          error,
        );
      }
    }, 30000);

    this.connectionHealthChecks.set(userId, interval);
  }

  cleanupConnectionHealthCheck(userId: number) {
    if (this.connectionHealthChecks.has(userId)) {
      clearInterval(this.connectionHealthChecks.get(userId));
      this.connectionHealthChecks.delete(userId);
    }
  }

  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(client: Socket) {
    const onlineUserIds = Array.from(this.connectedUsers.keys());
    return { onlineUserIds };
  }

  @SubscribeMessage('app_opened')
  async handleAppOpened(client: Socket) {
    const user = client.data.user;

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Store user in connected users map if not already there
    if (!this.connectedUsers.has(user.user_id)) {
      this.connectedUsers.set(user.user_id, client);
      console.log(`User ${user.user_id} marked as online (app opened)`);

      // Notify all clients about the user's online status
      this.server.emit('user_status_changed', {
        user_id: user.user_id,
        is_online: true,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('app_closed')
  async handleAppClosed(client: Socket) {
    const user = client.data.user;

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Remove user from connected users map
    this.connectedUsers.delete(user.user_id);
    console.log(`User ${user.user_id} marked as offline (app closed)`);

    // Clean up any connection health checks
    this.cleanupConnectionHealthCheck(user.user_id);

    // Notify all clients about the user's online status
    this.server.emit('user_status_changed', {
      user_id: user.user_id,
      is_online: false,
    });

    return { success: true };
  }

  @SubscribeMessage('call_answer_notify')
  async handleCallAnswerNotify(
    client: Socket,
    payload: { callId: string; conversationId?: number },
  ) {
    const { callId } = payload;
    const user = client.data.user;

    if (!user) {
      return { error: 'User not authenticated' };
    }

    console.log(`[Gateway] Received call_answer_notify for call ID: ${callId}`);

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Update last activity timestamp to prevent timeout
    call.lastActivity = new Date();

    return { success: true };
  }
}
