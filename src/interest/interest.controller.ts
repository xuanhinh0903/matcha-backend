import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { InterestService } from './interest.service';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import CreateInterestDto from './dto/createInterest.dto';

@ApiTags('Interest')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('interest')
export class InterestController {
  constructor(private readonly interestService: InterestService) {}

  @Get()
  async getAllInterests() {
    return this.interestService.getAllInterests();
  }

  // API: Thêm sở thích
  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        interest_name: { type: 'string', example: 'Basketball' },
      },
      required: ['interest_name'],
    },
  })
  async createInterest(@Body() createInterestDto: CreateInterestDto) {
    return this.interestService.createInterest(createInterestDto);
  }

  // API: Cập nhật sở thích
  @Put(':interestId')
  @ApiParam({
    name: 'interestId',
    type: 'number',
    example: 1,
    description: 'Interest ID cần cập nhật',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        interest_name: { type: 'string', example: 'Yoga' },
      },
      required: ['interest_name'],
    },
  })
  async updateInterest(
    @Param('interestId', ParseIntPipe) interestId: number,
    @Body() updateInterestDto: CreateInterestDto,
  ) {
    return this.interestService.updateInterest(interestId, updateInterestDto);
  }

  // API: Xóa sở thích
  @Delete(':interestId')
  @ApiParam({
    name: 'interestId',
    type: 'number',
    example: 2,
    description: 'Interest ID cần xóa',
  })
  async removeUserInterest(
    @Param('interestId', ParseIntPipe) interestId: number,
  ) {
    return this.interestService.deleteUserInterest(interestId);
  }
}
