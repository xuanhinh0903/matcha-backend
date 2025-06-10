import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
  Column,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Message } from '../message/message.entity';

@Entity()
// 1) composite index on (user1, user2) to accelerate bidirectional lookup
@Index('IDX_CONVERSATION_USERS', ['user1', 'user2'])
export class Conversation {
  @PrimaryGeneratedColumn()
  conversation_id: number;

  // 2) single‑column indexes on each FK
  @Index('IDX_CONV_USER1')
  @ManyToOne(() => User, (user) => user.matches1)
  user1: User;

  @Index('IDX_CONV_USER2')
  @ManyToOne(() => User, (user) => user.matches2)
  user2: User;

  // 3) index on creation date if you ORDER BY created_at frequently
  @Index('IDX_CONV_CREATED_AT')
  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
