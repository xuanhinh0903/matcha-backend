import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../converstation/converstation.entity';
import { NotificationModule } from '../notification/notification.module';
import { UserBlockModule } from '../user-block/user-block.module';
import { UserPhoto } from '../user-photo/entities/user-photo.entity';
import { UserModule } from '../user/user.module';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { RedisModule } from '../utils/redis/redis.module';
import { MessageController } from './message.controller';
import { Message } from './message.entity';
import { MessageGateway } from './message.gateway';
import { MessageService } from './message.service';
import { User } from 'src/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation, UserPhoto, User]),
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: `${configService.get('JWT_ACCESS_TOKEN_EXPIRATION_TIME')}s`,
        },
      }),
    }),
    UserBlockModule,
    CloudinaryModule,
    NotificationModule,
    RedisModule,
  ],
  providers: [MessageGateway, MessageService],
  controllers: [MessageController],
  exports: [MessageGateway, MessageService],
})
export class MessageModule {}
