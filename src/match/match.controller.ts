import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchService } from './match.service';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';

@ApiTags('Matching')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) { }

  @Post('like/:userId')
  async likeUser(@Req() req: RequestWithUser, @Param('userId') userId: number) {
    return this.matchService.likeUser(req.user.user_id, userId);
  }

  @Post('unlike/:userId')
  async unlikeUser(
    @Req() req: RequestWithUser,
    @Param('userId') userId: number,
  ) {
    return this.matchService.unlikeUser(req.user.user_id, userId);
  }

  @Post('dislike/:userId')
  async dislikeUser(
    @Req() req: RequestWithUser,
    @Param('userId') userId: number,
  ) {
    return this.matchService.dislikeUser(req.user.user_id, userId);
  }

  @Post('unmatch/:userId')
  async unmatchUser(
    @Req() req: RequestWithUser,
    @Param('userId') userId: number,
  ) {
    return this.matchService.unmatchUser(req.user.user_id, userId);
  }

  @Get('recommend')
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Name',
    example: "Xuan Hinh",
    default: "Xuan Hinh",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users per page',
    example: 10,
    default: 10,
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'Latitude of the current user',
    example: 37.7749,
  })
  @ApiQuery({
    name: 'lon',
    required: false,
    description: 'Longitude of the current user',
    example: -122.4194,
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    description: 'Gender of the partner',
    example: 'female',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    description: 'Range in kilometers to find matches',
    example: 50,
  })
  @ApiQuery({
    name: 'minAge',
    required: false,
    description: 'Minimum age of the partner',
    example: 18,
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    description: 'Maximum age of the partner',
    example: 30,
  })
  @ApiQuery({
    name: 'interests',
    required: false,
    description: 'Interests',
    example: "1,2,3",
    default: "1,2,3",
  })
  async getUsersForMatching(
    @Req() req: RequestWithUser,
    @Query('name') name?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('lat') lat?: number,
    @Query('lon') lon?: number,
    @Query('gender') gender?: string,
    @Query('range') range?: number,
    @Query('minAge') minAge?: number,
    @Query('maxAge') maxAge?: number,
    @Query('interests') interests?: string,
  ) {
    return this.matchService.getUsersForMatching(
      req.user.user_id,
      page,
      limit,
      lat && lon ? { lat, lon } : undefined,
      gender,
      range,
      minAge && maxAge ? { min: minAge, max: maxAge } : undefined,
      interests,
      name,
    );
  }

  @Get('likes-received')
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users per page',
    example: 10,
    default: 10,
  })
  async getLikesReceived(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.matchService.getLikesReceived(req.user.user_id, page, limit);
  }

  @Get('likes-sent')
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users per page',
    example: 10,
    default: 10,
  })
  async getLikesSent(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.matchService.getLikesSent(req.user.user_id, page, limit);
  }
}
