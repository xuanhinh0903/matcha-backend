import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './converstation.entity';
import { ConversationController } from './converstation.controller';
import { ConversationService } from './converstation.service';
import { UserModule } from 'src/user/user.module';
import { UserSettingsModule } from 'src/user-settings/user-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    UserModule,
    UserSettingsModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
