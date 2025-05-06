import { User } from '../user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Message } from '../message/message.entity';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn()
  conversation_id: number;

  @ManyToOne(() => User, (user) => user.matches1)
  user1: User;

  @ManyToOne(() => User, (user) => user.matches2)
  user2: User;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
