import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Column,
} from 'typeorm';

@Entity()
export class UserBlock {
  @PrimaryGeneratedColumn()
  block_id: number;

  @ManyToOne(() => User, (user) => user.blocks)
  blocker: User;

  @ManyToOne(() => User, (user) => user.blocks)
  blocked: User;

  @CreateDateColumn()
  blocked_at: Date;
}
