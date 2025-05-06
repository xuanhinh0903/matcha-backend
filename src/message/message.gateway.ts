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
      client.disconnect();
      return;
    }

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userService.getById(decoded.userId);

      if (!user) {
        console.log('Not user and disconnect');
        client.disconnect();
        return;
      }

      this.connectedUsers.set(user.user_id, client);
      client.data.user = user;

      // Join personal room first
      client.join(`user-${user.user_id}`);

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
        `User ${user.user_id} connected, joined ${conversationIds.length} rooms`,
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
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('handleDisconnect');
    if (client.data.user) {
      const userId = client.data.user.user_id;
      this.connectedUsers.delete(userId);
      this.cleanupConnectionHealthCheck(userId);

      // Check if user was in any active calls
      this.handleDisconnectFromCalls(userId);
    }
  }

  private async handleDisconnectFromCalls(userId: number) {
    console.log('handleDisconnectFromCalls');
    // Find any active calls where this user is participating
    for (const [callId, call] of this._activeCalls.entries()) {
      if (call.callerId === userId || call.receiverId === userId) {
        if (call.status === 'connected' || call.status === 'ringing') {
          // Mark the call as ended due to disconnection
          call.status = 'ended';
          call.endTime = new Date();

          // Notify the other party
          const otherUserId =
            call.callerId === userId ? call.receiverId : call.callerId;
          if (this.connectedUsers.has(otherUserId)) {
            this.server.to(`user-${otherUserId}`).emit('call_ended', {
              callId,
              conversationId: call.conversationId,
              reason: 'disconnected',
              duration: Math.floor(
                (call.endTime.getTime() - call.startTime.getTime()) / 1000,
              ),
            });
          }

          // Store call record in database
          await this.storeCallRecord(call);

          // Remove the call after a timeout
          setTimeout(() => {
            this._activeCalls.delete(callId);
          }, 60000); // Keep record for 1 minute for potential reconnection
        }
      }
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

      if (conversation) {
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
            const minutes = Math.floor(callDuration / 60);
            const seconds = callDuration % 60;
            statusText = `Call duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
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

          await this.messageRepository.save(message);
        }
      }
    } catch (error) {
      console.error('Error storing call record:', error);
    }
  }

  private emitIncomingCall(callId: string, call: Call) {
    console.log('emitIncomingCall');
    try {
      const receiverSocket = this.connectedUsers.get(call.receiverId);
      if (!receiverSocket) return;

      // Get user info for the caller
      this.userService.getById(call.callerId).then((callerInfo) => {
        if (!callerInfo) return;

        // Emit call_received event to the receiver
        this.server.to(`user-${call.receiverId}`).emit('call_received', {
          callId,
          conversationId: call.conversationId,
          callType: call.type,
          caller: {
            user_id: callerInfo.user_id,
            full_name: callerInfo.full_name,
            photo_url: callerInfo.photos?.find((e) => e.is_profile_picture)
              .photo_url,
          },
        });
      });
    } catch (error) {
      console.error('Error emitting incoming call:', error);
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

                // Store call record
                this.storeCallRecord(currentCall);

                // Keep the call record for a short while then delete
                setTimeout(() => {
                  this._activeCalls.delete(callId);
                }, 60000);
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
        this.emitIncomingCall(callId, newCall);
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

    // Store call record
    await this.storeCallRecord(call);

    // Keep call record briefly then remove
    setTimeout(() => {
      this._activeCalls.delete(callId);
    }, 60000);

    return { success: true };
  }

  @SubscribeMessage('call_end')
  async handleCallEnd(client: Socket, payload: { callId: string }) {
    const { callId } = payload;
    const user = client.data.user;

    if (!user) {
      return { error: 'User not authenticated' };
    }

    const call = this._activeCalls.get(callId);
    if (!call) {
      return { error: 'Call not found' };
    }

    // Only participants can end the call
    if (call.callerId !== user.user_id && call.receiverId !== user.user_id) {
      return { error: 'You cannot end this call' };
    }

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

    // Notify the other participant
    const otherUserId =
      call.callerId === user.user_id ? call.receiverId : call.callerId;
    this.server.to(`user-${otherUserId}`).emit('call_ended', {
      callId,
      conversationId: call.conversationId,
      duration: durationSeconds,
      endedBy: user.user_id,
    });

    // Store call record
    await this.storeCallRecord(call);

    // Keep call record briefly then remove
    setTimeout(() => {
      this._activeCalls.delete(callId);
    }, 60000);

    return {
      success: true,
      duration: durationSeconds,
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
      (call.status === 'missed' || call.status === 'ended') &&
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

            // Store the call record
            this.storeCallRecord(currentCall);

            // Clean up after a delay
            setTimeout(() => {
              this._activeCalls.delete(callId);
            }, 60000);
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
