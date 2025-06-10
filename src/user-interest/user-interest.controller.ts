import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import { UserInterestService } from './user-interest.service';
import { UserInterestDto } from './dto/UserInterest.dto';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';

@ApiTags('User Interest')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('user-interest')
export class UserInterestController {
  constructor(private readonly userInterestService: UserInterestService) {}

  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        interestIds: {
          type: 'array',
          items: { type: 'number' },
          example: [2, 4, 7],
        },
      },
      required: ['interestIds'],
    },
  })
  async setUserInterests(
    @Req() req: RequestWithUser,
    @Body() userInterestDto: UserInterestDto,
  ) {
    return this.userInterestService.setUserInterests(
      req.user.user_id,
      userInterestDto.interestIds,
    );
  }

  @Get()
  async getUserInterests(@Req() req: RequestWithUser) {
    return this.userInterestService.getUserInterests(req.user.user_id);
  }
}
