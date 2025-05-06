import { Module } from '@nestjs/common';
import { UserInterestService } from './user-interest.service';
import { UserInterestController } from './user-interest.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interest } from 'src/interest/entities/interest.entity';
import { UserInterest } from './entities/user-interest.entity';
import { User } from 'src/user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Interest, UserInterest,User])],
  providers: [UserInterestService],
  controllers: [UserInterestController]
})
export class UserInterestModule {}
