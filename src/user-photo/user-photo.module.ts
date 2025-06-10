import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPhoto } from './entities/user-photo.entity';
import { UserPhotoService } from './user-photo.service';
import { UserPhotoController } from './user-photo.controller';
import { User } from 'src/user/entities/user.entity';
import { CloudinaryService } from 'src/utils/cloudinary/cloudinary.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserPhoto, User])],
  controllers: [UserPhotoController],
  providers: [UserPhotoService, CloudinaryService],
  exports: [UserPhotoService],
})
export class UserPhotoModule {}
