
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
const streamifier = require('streamifier');

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File, folder: string): Promise<{ originalUrl: string; thumbnailUrl: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          eager: [{ width: 150, height: 150, crop: 'thumb' }], // Cloudinary tạo thumbnail ngay khi upload
        },
        (error, result) => {
          if (error) {
            console.error('Error uploading image to Cloudinary:', error);
            return reject(error);
          }

          // Lấy URL ảnh gốc & thumbnail
          const originalUrl = result.secure_url;
          const thumbnailUrl = result.eager?.[0]?.secure_url || this.getThumbnailUrl(originalUrl, 150, 150);
          const publicId = result.public_id;

          resolve({ originalUrl, thumbnailUrl, publicId });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // 🔹 Nếu không dùng `eager`, tạo URL thumbnail từ ảnh gốc
  private getThumbnailUrl(imageUrl: string, width: number, height: number): string {
    return imageUrl.replace('/upload/', `/upload/w_${width},h_${height},c_thumb/`);
  }

  // **Xóa ảnh trên Cloudinary**
  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
   // ✅ **Xóa tất cả ảnh theo danh sách publicIds**
   async deleteMultipleImages(publicIds: string[]): Promise<void> {
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds);
    }
  }

  
}
