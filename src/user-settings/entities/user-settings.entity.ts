import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

type PrivacyLevel = 'private' | 'matches' | 'public';

@Entity()
export class UserSettings {
  @PrimaryGeneratedColumn()
  settings_id: number;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  // Privacy settings
  @Column({
    type: 'enum',
    enum: ['private', 'matches', 'public'],
    default: 'public',
  })
  privacy_photos: PrivacyLevel;

  @Column({
    type: 'enum',
    enum: ['private', 'matches', 'public'],
    default: 'public',
  })
  privacy_bio: PrivacyLevel;

  @Column({
    type: 'enum',
    enum: ['private', 'matches', 'public'],
    default: 'matches',
  })
  privacy_age: PrivacyLevel;

  @Column({
    type: 'enum',
    enum: ['private', 'matches', 'public'],
    default: 'public',
  })
  privacy_interests: PrivacyLevel;

  // @Column({
  //   type: 'enum',
  //   enum: ['private', 'matches', 'public'],
  //   default: 'private',
  // })
  // privacy_match_stats: PrivacyLevel;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
