import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { Match } from 'src/match/match.entity';
import { UserPhoto } from 'src/user-photo/entities/user-photo.entity';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { Interest } from 'src/interest/entities/interest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Match,
      UserPhoto,
      UserInterest,
      Interest,
      UserPhoto,
    ]),
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
