import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './converstation.entity';
import { ConversationController } from './converstation.controller';
import { ConversationService } from './converstation.service';
import { UserModule } from 'src/user/user.module';
import { UserSettingsModule } from 'src/user-settings/user-settings.module';
import { User } from 'src/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, User]),
    UserModule,
    UserSettingsModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
