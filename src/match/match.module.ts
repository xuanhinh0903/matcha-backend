import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './match.entity';
import { User } from 'src/user/entities/user.entity';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { Conversation } from '../converstation/converstation.entity';
import { MessageModule } from '../message/message.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  providers: [MatchService],
  controllers: [MatchController],
  imports: [
    TypeOrmModule.forFeature([Match, User, UserInterest, Conversation]),
    MessageModule,
    NotificationModule,
  ],
})
export class MatchModule {}
