import { CloudinaryService } from 'src/utils/cloudinary/cloudinary.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserPhoto } from './entities/user-photo.entity';

@Injectable()
export class UserPhotoService {
  constructor(
    @InjectRepository(UserPhoto)
    private readonly photoRepo: Repository<UserPhoto>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly cloudinary: CloudinaryService,
  ) {}

  // **Upload nhiều ảnh**
  async uploadPhotos(
    userId: number,
    files: Express.Multer.File[] | Express.Multer.File,
  ) {
    console.log('files', files);
    // Normalize files to always be an array
    const fileArray = Array.isArray(files) ? files : [files];
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const uploadedPhotos = await Promise.all(
      fileArray?.map(async (file) => {
        const uploadResult = await this.cloudinary.uploadImage(
          file,
          process.env.CLOUDINARY_FOLDER || 'upload-photo-w2bgj6k8',
        );

        if (
          !uploadResult.originalUrl ||
          !uploadResult.thumbnailUrl ||
          !uploadResult.publicId
        ) {
          throw new Error('Failed to upload image to Cloudinary');
        }

        const newPhoto = this.photoRepo.create({
          user,
          photo_url: uploadResult.originalUrl,
          public_id: uploadResult.publicId,
          photo_url_thumbnail: uploadResult.thumbnailUrl,
          is_profile_picture: false,
        });

        return this.photoRepo.save(newPhoto);
      }),
    );

    return uploadedPhotos;
  }

  // **Cập nhật nhiều ảnh (xóa ảnh cũ, thêm ảnh mới)**
  async updatePhotos(
    userId: number,
    photoIds: number[],
    files: Express.Multer.File[],
  ) {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!photoIds.length) throw new NotFoundException('No photos to update');

    // Lấy danh sách ảnh cũ
    const oldPhotos = await this.photoRepo.find({
      where: { photo_id: In(photoIds) },
    });

    if (!oldPhotos.length) throw new NotFoundException('Old photos not found');

    // Xóa ảnh cũ trên Cloudinary
    await Promise.all(
      oldPhotos.map(
        (photo) =>
          photo.public_id && this.cloudinary.deleteImage(photo.public_id),
      ),
    );

    // Xóa dữ liệu ảnh cũ trong DB
    await this.photoRepo.remove(oldPhotos);

    // Upload ảnh mới
    const uploadedPhotos = await Promise.all(
      files.map(async (file) => {
        const uploadResult = await this.cloudinary.uploadImage(
          file,
          process.env.CLOUDINARY_FOLDER || 'upload-photo-w2bgj6k8',
        );

        if (
          !uploadResult ||
          !uploadResult.originalUrl ||
          !uploadResult.publicId
        ) {
          throw new Error('Failed to upload image to Cloudinary');
        }

        const newPhoto = this.photoRepo.create({
          user,
          photo_url: uploadResult.originalUrl,
          public_id: uploadResult.publicId,
          photo_url_thumbnail: uploadResult.thumbnailUrl,
          is_profile_picture: false,
        });

        return this.photoRepo.save(newPhoto);
      }),
    );
    console.log('Uploaded photos:', uploadedPhotos);
    return uploadedPhotos;
  }

  // **Lấy danh sách ảnh của user**
  async getUserPhotos(userId: number) {
    return this.photoRepo.find({
      where: { user: { user_id: userId } },
    });
  }

  // **Xóa ảnh theo ID**
  async deletePhoto(userId: number, photoId: number) {
    const photo = await this.photoRepo.findOne({
      where: { photo_id: photoId, user: { user_id: userId } },
    });

    if (!photo) throw new NotFoundException('Photo not found');

    // Xóa trên Cloudinary nếu có public_id
    if (photo.public_id) {
      await this.cloudinary.deleteImage(photo.public_id);
    }

    // Xóa dữ liệu trong DB
    return this.photoRepo.remove(photo);
  }

  async deleteAllUserPhotos(
    userId: number,
  ): Promise<{ deletedPhotos: string[] }> {
    // Lấy tất cả ảnh của user
    const userPhotos = await this.photoRepo.find({
      where: { user: { user_id: userId } },
    });

    if (userPhotos.length === 0) {
      throw new NotFoundException('No photos found for this user');
    }

    // Lấy danh sách public_id từ Cloudinary
    const publicIds = userPhotos
      .map((photo) => photo.public_id)
      .filter((id) => id);

    // Xóa ảnh trên Cloudinary
    await this.cloudinary.deleteMultipleImages(publicIds);

    // Xóa dữ liệu trong DB
    await this.photoRepo.remove(userPhotos);
    return { deletedPhotos: publicIds };
  }
  // New method: Update user avatar
  async updateAvatar(userId: number, file: Express.Multer.File) {
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Find and delete the existing avatar if it exists
    const oldAvatar = await this.photoRepo.findOne({
      where: { user: { user_id: userId }, is_profile_picture: true },
    });

    if (oldAvatar) {
      if (oldAvatar.public_id) {
        await this.cloudinary.deleteImage(oldAvatar.public_id);
      }
      await this.photoRepo.remove(oldAvatar);
    }

    // Upload new avatar image
    const uploadResult = await this.cloudinary.uploadImage(
      file,
      process.env.CLOUDINARY_FOLDER || 'upload-photo-w2bgj6k8',
    );

    if (!uploadResult.originalUrl || !uploadResult.publicId) {
      throw new Error('Failed to upload image to Cloudinary');
    }

    // Save new avatar with the is_profile_picture flag
    const newAvatar = this.photoRepo.create({
      user,
      photo_url: uploadResult.originalUrl,
      public_id: uploadResult.publicId,
      photo_url_thumbnail: uploadResult.thumbnailUrl,
      is_profile_picture: true,
    });

    return this.photoRepo.save(newAvatar);
  }
}
