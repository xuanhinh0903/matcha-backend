import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserBlock } from './entities/user-block.entity';
import { UserBlockService } from './user-block.service';
import { UserBlockController } from './user-block.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserBlock])],
  providers: [UserBlockService],
  controllers: [UserBlockController],
  exports: [UserBlockService], // Export to make it available to other modules
})
export class UserBlockModule {}
