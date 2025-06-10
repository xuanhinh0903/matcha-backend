import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Req,
  Delete,
  Param,
  Get,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UserPhotoService } from './user-photo.service';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { MAX_UPLOAD_PHOTOS } from './constant/user-photo.constant';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('User Photos')
@ApiBearerAuth()
@Controller('user-photo')
export class UserPhotoController {
  constructor(private readonly userPhotoService: UserPhotoService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Get user photos' })
  async getUserPhotos(@Req() req: RequestWithUser) {
    const userId = req.user.user_id;
    console.log('getUserPhotos User ID:', userId);
    const result = await this.userPhotoService.getUserPhotos(userId);
    console.log('User photos:', result);
    return result;
  }

  // Upload multiple photos
  @Post('upload-multiple')
  @UseGuards(JwtGuard)
  @UseInterceptors(FilesInterceptor('files', MAX_UPLOAD_PHOTOS))
  @ApiOperation({ summary: 'Upload multiple photos for user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async uploadMultiple(
    @Req() req: RequestWithUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user.user_id;
    console.log('files', files);
    console.log('User ID:', userId);
    return this.userPhotoService.uploadPhotos(userId, files);
  }

  // Delete photo by ID
  @Delete('delete/:photoId')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Delete photo by ID' })
  async deletePhoto(
    @Req() req: RequestWithUser,
    @Param('photoId') photoId: number,
  ) {
    const userId = req.user.user_id;
    return this.userPhotoService.deletePhoto(userId, photoId);
  }

  // Delete all photos of the user
  @Delete('delete-all')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Delete all photos of the user' })
  async deleteAllPhotos(
    @Req() req: RequestWithUser,
  ): Promise<{ deletedPhotos: string[] }> {
    const userId = req.user.user_id;
    return this.userPhotoService.deleteAllUserPhotos(userId);
  }

  @Post('update-avatar')
  @UseGuards(JwtGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Update user avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async updateAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.user_id;
    return this.userPhotoService.updateAvatar(userId, file);
  }
}
