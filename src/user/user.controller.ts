import {
  Controller,
  Get,
  Put,
  Delete,
  Req,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { UpdateUserDto } from './dto/updateUser.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserInfoDto } from './dto/user-info.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserMatchStatsDto } from './dto/user-match-stats';
import { BasicUserProfileDto } from './dto/basic-user-profile.dto';
import { UserPhotoDto } from 'src/user-photo/dto/user-photo.dto';

@ApiBearerAuth()
@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('info')
  @UseGuards(JwtGuard)
  @ApiOkResponse({ type: UserInfoDto })
  async getUserInfo(@Req() req: RequestWithUser): Promise<UserInfoDto> {
    const user = await this.userService.getUserInfo(req.user.user_id);
    return user;
  }

  @Get('matchStats')
  @UseGuards(JwtGuard)
  @ApiOkResponse({ type: UserMatchStatsDto })
  async getMatchStats(@Req() req: RequestWithUser): Promise<UserMatchStatsDto> {
    const user = await this.userService.getMatchStats(req.user.user_id);
    console.log('Match stats:', user);
    return user;
  }

  @Put('update')
  @UseGuards(JwtGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        phone_number: { type: 'string', example: '1234567890' },
        full_name: { type: 'string', example: 'John Doe' },
        birthdate: { type: 'string', format: 'date', example: '1990-01-01' },
        gender: {
          type: 'string',
          enum: ['male', 'female', 'other'],
          example: 'male',
        },
        location: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['Point'],
              example: 'Point',
            },
            coordinates: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
              example: [105.8542, 21.0285],
              description: 'Array of [longitude, latitude]',
            },
          },
          required: ['type', 'coordinates'],
          example: {
            type: 'Point',
            coordinates: [105.8542, 21.0285],
          },
        },
        bio: { type: 'string', example: 'This is a bio' },
      },
      required: [],
    },
  })
  async updateUser(
    @Req() req: RequestWithUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.userService.updateUser(
      req.user.user_id,
      updateUserDto,
    );
    return updatedUser;
  }

  @Put('online-status')
  @UseGuards(JwtGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isOnline: { type: 'boolean', example: true },
      },
      required: ['isOnline'],
    },
  })
  async updateOnlineStatus(
    @Req() req: RequestWithUser,
    @Body() { isOnline }: { isOnline: boolean },
  ) {
    await this.userService.updateOnlineStatus(req.user.user_id, isOnline);
    return { success: true, isOnline };
  }

  @Delete('delete')
  @UseGuards(JwtGuard)
  async deleteUser(@Req() req: RequestWithUser) {
    await this.userService.deleteUser(req.user.user_id);
    return { message: 'User deleted successfully' };
  }

  @Get('profile/:id')
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiOkResponse({ type: UserProfileDto, description: 'User profile' })
  async getUserProfile(@Param('id') id: string): Promise<UserProfileDto> {
    console.log('Fetching user profile for ID:', id);
    return this.userService.getUserProfile(+id);
  }

  @Get('profile/:id/basic')
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiOkResponse({
    type: BasicUserProfileDto,
    description: 'Basic user profile without photos and interests',
  })
  async getBasicUserProfile(
    @Param('id') id: string,
  ): Promise<BasicUserProfileDto> {
    console.log('Fetching basic user profile for ID:', id);
    return this.userService.getBasicUserProfile(+id);
  }

  @Get('profile/:id/photos')
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiOkResponse({ type: [UserPhotoDto], description: 'User photos' })
  async getUserPhotos(@Param('id') id: string): Promise<UserPhotoDto[]> {
    console.log('Fetching photos for user ID:', id);
    return this.userService.getUserPhotos(+id);
  }

  @Get('profile/:id/interests')
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'id', description: 'User ID', type: 'number' })
  @ApiOkResponse({ type: [String], description: 'User interests' })
  async getUserInterests(@Param('id') id: string): Promise<string[]> {
    console.log('Fetching interests for user ID:', id);
    return this.userService.getUserInterests(+id);
  }
}
