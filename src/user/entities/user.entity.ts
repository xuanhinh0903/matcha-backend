import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude, Type } from 'class-transformer';

import { DeviceToken } from '../../notification/entities/device-token.entity';
import { Match } from '../../match/match.entity';
import { Message } from '../../message/message.entity';
import { Notification } from '../../notification/notification.entity';
import { Point } from 'geojson';
import { UserBlock } from '../../user-block/entities/user-block.entity';
import { UserInterest } from '../../user-interest/entities/user-interest.entity';
import { UserPhoto } from '../../user-photo/entities/user-photo.entity';
import { UserSettings } from '../../user-settings/entities/user-settings.entity';

@Entity()
export class User {
  @Index({ unique: true })
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone_number: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  full_name: string;

  @CreateDateColumn({ nullable: true })
  @Type(() => Date)
  birthdate: Date;

  @Column({ type: 'enum', enum: ['male', 'female', 'other'], nullable: true })
  gender: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @OneToMany(() => UserPhoto, (userPhoto) => userPhoto.user)
  photos: UserPhoto[];

  @OneToMany(() => Match, (match) => match.user1)
  matches1: Match[];

  @OneToMany(() => Match, (match) => match.user2)
  matches2: Match[];

  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];

  @OneToMany(() => UserBlock, (userBlock) => userBlock.blocker)
  blocks: UserBlock[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => UserInterest, (userInterest) => userInterest.user)
  interests: UserInterest[];

  @Column({ nullable: true })
  last_active: Date;

  @Column({ default: false })
  is_online: boolean;

  @Column({ default: false })
  is_verified: boolean;

  @OneToOne(() => UserSettings, (userSettings) => userSettings.user)
  settings: UserSettings;

  @OneToMany(() => DeviceToken, (deviceToken) => deviceToken.user)
  deviceTokens: DeviceToken[];

  @CreateDateColumn({ nullable: true })
  @Type(() => Date)
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  @Type(() => Date)
  updated_at: Date;

  @Column({ default: false })
  is_banned: boolean;

  @Column({ type: 'text', nullable: true })
  ban_reason: string;

  @Column({ nullable: true })
  @Type(() => Date)
  banned_at: Date;

  @Column({ nullable: true })
  @Type(() => Date)
  ban_expires_at: Date;
}
