import { User } from '../user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Column,
} from 'typeorm';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  notification_id: number;

  @ManyToOne(() => User, (user) => user.notifications)
  user: User;

  @Column({
    type: 'enum',
    enum: ['message', 'match', 'block', 'like', 'system'],
  })
  notification_type: string;

  @Column({ type: 'text' })
  notification_content: string;

  @Column({ type: 'enum', enum: ['unread', 'read'], default: 'unread' })
  notification_status: string;

  @CreateDateColumn()
  sent_at: Date;
}
