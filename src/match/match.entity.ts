import { User } from '../user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

export enum MatchStatus {
  LIKED = 'liked',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
  PENDING = 'pending',
  UNMATCHED = 'unmatched',
}

@Entity()
export class Match {
  @PrimaryGeneratedColumn()
  match_id: number;

  @ManyToOne(() => User, (user) => user.matches1)
  user1: User;

  @ManyToOne(() => User, (user) => user.matches2)
  user2: User;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.PENDING,
  })
  match_status: string;

  @Column({ nullable: true })
  liked_at: Date;

  @CreateDateColumn()
  matched_at: Date;
}
