import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Query,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/authentication/guards/jwt.guard';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import RequestWithUser from 'src/authentication/interfaces/requestWithUser.interface';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { Roles } from 'src/authentication/decorators/roles.decorator';
import { RolesGuard } from 'src/authentication/guards/roles.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reportedUserId: { type: 'integer', example: 123 },
        reportReason: {
          type: 'string',
          enum: [
            'fake_profile',
            'inappropriate_content',
            'harassment',
            'other',
          ],
          example: 'harassment',
        },
        details: {
          type: 'string',
          example: 'User is sending inappropriate messages',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Evidence images for the report',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 5))
  async createReport(
    @Req() req: RequestWithUser,
    @Body() createReportDto: CreateReportDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    console.log({
      userId: req.user.user_id,
      reportedUserId: createReportDto.reportedUserId,
      reportReason: createReportDto.reportReason,
      details: createReportDto.details,
      files,
    });
    return this.reportService.createReport(
      req.user.user_id,
      createReportDto,
      files,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiQuery({
    name: 'filter',
    required: false,
    description:
      'Filter reports by status (pending, reviewed, closed) or type (fake_profile, inappropriate_content, harassment, other)',
  })
  async getAllReports(@Query('filter') filter?: string) {
    return this.reportService.getAllReports(filter);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: 'number', description: 'Report ID' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getReportById(@Param('id', ParseIntPipe) id: number) {
    return this.reportService.getReportById(id);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiParam({ name: 'id', type: 'number', description: 'Report ID' })
  @ApiBody({ type: ResolveReportDto })
  async resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() resolveReportDto: ResolveReportDto,
  ) {
    return this.reportService.resolveReport(id, resolveReportDto);
  }

  @Get('user/submitted')
  @ApiQuery({
    name: 'filter',
    required: false,
    description:
      'Filter reports by status (pending, reviewed, closed) or type (fake_profile, inappropriate_content, harassment, other)',
  })
  async getUserSubmittedReports(
    @Req() req: RequestWithUser,
    @Query('filter') filter?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.reportService.getUserSubmittedReports(
      req.user.user_id,
      filter,
      sortOrder,
    );
  }
}
