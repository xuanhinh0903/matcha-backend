import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  // Use a dedicated namespace for messages
  namespace: 'calls',
})
export class CallGateway {
  @WebSocketServer()
  server: Server;

  // Keep track of active calls and their participants
  private activeCallRooms = new Map<string, Set<string>>();

  @SubscribeMessage('join_room')
  async joinRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() socket: Socket,
  ) {
    const room = this.server.in(roomName);

    const roomSockets = await room.fetchSockets();
    const numberOfPeopleInRoom = roomSockets.length;

    // a maximum of 2 people in a room
    if (numberOfPeopleInRoom > 1) {
      room.emit('too_many_people');
      return;
    }

    if (numberOfPeopleInRoom === 1) {
      room.emit('another_person_ready');
    }

    socket.join(roomName);
  }

  @SubscribeMessage('send_connection_offer')
  async sendConnectionOffer(
    @MessageBody()
    {
      offer,
      roomName,
    }: {
      offer: RTCSessionDescriptionInit;
      roomName: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.in(roomName).except(socket.id).emit('send_connection_offer', {
      offer,
      roomName,
    });
  }

  @SubscribeMessage('answer')
  async answer(
    @MessageBody()
    {
      answer,
      roomName,
    }: {
      answer: RTCSessionDescriptionInit;
      roomName: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.in(roomName).except(socket.id).emit('answer', {
      answer,
      roomName,
    });
  }

  @SubscribeMessage('send_candidate')
  async sendCandidate(
    @MessageBody()
    {
      candidate,
      roomName,
    }: {
      candidate: unknown;
      roomName: string;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.in(roomName).except(socket.id).emit('send_candidate', {
      candidate,
      roomName,
    });
  }

  // New WebRTC signaling events to match our frontend implementation

  @SubscribeMessage('relay_sdp')
  async relaySDP(
    @MessageBody()
    {
      callId,
      type,
      sdp,
    }: {
      callId: string;
      type: string;
      sdp: any;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(`[CallGateway] Relaying ${type} SDP for call ${callId}`);

    // Add user to the call room if not already added
    this.addUserToCallRoom(callId, socket.id);

    // Relay the SDP to all other users in the call room
    socket.to(callId).emit('relay_sdp', {
      callId,
      type,
      sdp,
    });
  }

  @SubscribeMessage('relay_ice_candidate')
  async relayIceCandidate(
    @MessageBody()
    {
      callId,
      candidate,
    }: {
      callId: string;
      candidate: any;
    },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(`[CallGateway] Relaying ICE candidate for call ${callId}`);

    // Add user to the call room if not already added
    this.addUserToCallRoom(callId, socket.id);

    // Relay the ICE candidate to all other users in the call room
    socket.to(callId).emit('relay_ice_candidate', {
      callId,
      candidate,
    });
  }

  @SubscribeMessage('leave_room')
  async leaveRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log(`[CallGateway] Client ${socket.id} leaving room ${roomName}`);

    // Leave the socket room
    socket.leave(roomName);

    // Get the room participants before we remove the socket
    const participants = this.activeCallRooms.get(roomName);

    // Notify everyone in the room (including the original sender via the server broadcast)
    // This ensures all clients get the notification, not just those remaining in the room
    this.server.emit('peer_disconnected', {
      callId: roomName,
      socketId: socket.id,
    });

    // Emit forced_disconnect to the socket that's leaving
    socket.emit('forced_disconnect', {
      message: 'Call ended, reconnecting chat socket',
      shouldReconnect: true,
    });

    // Clean up from our tracking data structure
    if (this.activeCallRooms.has(roomName)) {
      if (participants && participants.has(socket.id)) {
        participants.delete(socket.id);

        // Log which parties remain in the call for debugging
        if (participants.size > 0) {
          console.log(
            `[CallGateway] ${participants.size} clients remain in call room ${roomName}`,
          );
        } else {
          console.log(
            `[CallGateway] Last client left call room ${roomName}, removing room`,
          );
          this.activeCallRooms.delete(roomName);
        }
      }
    }
  }

  // Helper to add a user to a call room
  private addUserToCallRoom(callId: string, socketId: string): void {
    // Join the socket to the call room
    const socket = this.server.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(callId);
    }

    // Track participants in the call room
    if (!this.activeCallRooms.has(callId)) {
      this.activeCallRooms.set(callId, new Set<string>());
    }
    this.activeCallRooms.get(callId).add(socketId);
  }

  // Improved handleDisconnect method to ensure proper cleanup
  handleDisconnect(socket: Socket) {
    console.log(`[CallGateway] Client disconnected: ${socket.id}`);

    // Find and remove the user from any call rooms they were in
    this.activeCallRooms.forEach((participants, callId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        console.log(
          `[CallGateway] User ${socket.id} removed from call room ${callId}`,
        );

        // If there are no more participants, remove the call room
        if (participants.size === 0) {
          this.activeCallRooms.delete(callId);
          console.log(
            `[CallGateway] Call room ${callId} removed (no participants left)`,
          );
        } else {
          // Notify remaining participants about the disconnection
          socket.to(callId).emit('peer_disconnected', { callId });
          console.log(
            `[CallGateway] Notified remaining participants in ${callId} about disconnection of ${socket.id}`,
          );
        }
      }
    });
  }
}
