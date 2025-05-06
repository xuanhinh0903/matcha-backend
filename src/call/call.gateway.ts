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

    // Notify others in the room that this peer has left
    this.server.in(roomName).emit('peer_disconnected', { callId: roomName });

    // Clean up from our tracking data structure
    if (this.activeCallRooms.has(roomName)) {
      const participants = this.activeCallRooms.get(roomName);
      if (participants.has(socket.id)) {
        participants.delete(socket.id);

        // If there are no more participants, remove the call room
        if (participants.size === 0) {
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

  // Handle disconnections to clean up call rooms
  handleDisconnect(socket: Socket) {
    console.log(`[CallGateway] Client disconnected: ${socket.id}`);

    // Find and remove the user from any call rooms they were in
    this.activeCallRooms.forEach((participants, callId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);

        // If there are no more participants, remove the call room
        if (participants.size === 0) {
          this.activeCallRooms.delete(callId);
        } else {
          // Notify remaining participants about the disconnection
          socket.to(callId).emit('peer_disconnected', { callId });
        }
      }
    });
  }
}
