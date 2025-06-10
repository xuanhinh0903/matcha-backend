import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../converstation/converstation.entity';
import { User } from '../user/entities/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  message_id: number;

  @Index()
  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  conversation: Conversation;

  @ManyToOne(() => User, (user) => user.messages)
  sender: User;

  @Column({ type: 'enum', enum: ['text', 'emoji', 'sticker', 'image', 'gif'] })
  content_type: string;

  @Column({ type: 'text' })
  @Index({ fulltext: true })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  sent_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date;

  @Column({ nullable: true })
  type: 'text' | 'call' | 'video'; // Add new types for calls

  @Column({ nullable: true })
  callStatus: 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';

  @Column({ length: 20, nullable: true })
  callType?: string; // audio, video

  @Column({ type: 'int', nullable: true })
  duration?: number; // Duration in seconds for calls
}
