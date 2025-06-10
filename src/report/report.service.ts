import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { User } from 'src/user/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportImage } from './entities/report-image.entity';
import { CloudinaryService } from 'src/utils/cloudinary/cloudinary.service';
import { ResolveReportDto } from './dto/resolve-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ReportImage)
    private reportImageRepository: Repository<ReportImage>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createReport(
    reporterId: number,
    createReportDto: CreateReportDto,
    files?: Express.Multer.File[],
  ) {
    const reporter = await this.userRepository.findOne({
      where: { user_id: reporterId },
    });

    if (!reporter) {
      throw new NotFoundException('Reporter not found');
    }

    const reported = await this.userRepository.findOne({
      where: { user_id: createReportDto.reportedUserId },
    });

    if (!reported) {
      throw new NotFoundException('Reported user not found');
    }

    // Create and save the report
    const report = this.reportRepository.create({
      reporter,
      reported,
      report_reason: createReportDto.reportReason,
      details: createReportDto.details,
      status: 'pending',
    });

    const savedReport = await this.reportRepository.save(report);

    // Handle uploaded files if provided
    if (files && files.length > 0) {
      const reportImages = await Promise.all(
        files.map(async (file) => {
          const uploadResult = await this.cloudinaryService.uploadImage(
            file,
            'report-evidence',
          );

          return this.reportImageRepository.create({
            original_url: uploadResult.originalUrl,
            thumbnail_url: uploadResult.thumbnailUrl,
            public_id: uploadResult.publicId,
            report: savedReport,
          });
        }),
      );

      await this.reportImageRepository.save(reportImages);
    }

    return {
      success: true,
      report_id: savedReport.report_id,
      message: 'Report submitted successfully',
    };
  }

  async getAllReports(filter?: string) {
    const query = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reported', 'reported')
      .leftJoinAndSelect('report.images', 'images');

    if (filter) {
      if (
        filter === 'pending' ||
        filter === 'reviewed' ||
        filter === 'closed'
      ) {
        query.where('report.status = :status', { status: filter });
      } else if (
        filter === 'fake_profile' ||
        filter === 'inappropriate_content' ||
        filter === 'harassment' ||
        filter === 'other'
      ) {
        query.where('report.report_reason = :reason', { reason: filter });
      }
    }

    query.orderBy('report.created_at', 'DESC');

    return query.getMany();
  }

  async getReportById(reportId: number) {
    const report = await this.reportRepository.findOne({
      where: { report_id: reportId },
      relations: ['reporter', 'reported', 'images'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    return report;
  }

  async resolveReport(reportId: number, resolveReportDto: ResolveReportDto) {
    const report = await this.reportRepository.findOne({
      where: { report_id: reportId },
      relations: ['reported'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const reportedUser = report.reported;

    // Update report status
    report.status = 'closed';
    await this.reportRepository.save(report);

    // Apply actions to the reported user
    if (resolveReportDto.action === 'ban') {
      reportedUser.is_banned = true;
      reportedUser.ban_reason =
        resolveReportDto.reason || 'Violation of community guidelines';
      reportedUser.banned_at = new Date();

      if (resolveReportDto.banDays) {
        const banExpiryDate = new Date();
        banExpiryDate.setDate(
          banExpiryDate.getDate() + resolveReportDto.banDays,
        );
        reportedUser.ban_expires_at = banExpiryDate;
      }

      await this.userRepository.save(reportedUser);
    } else if (resolveReportDto.action === 'delete') {
      await this.userRepository.remove(reportedUser);
    }

    return {
      success: true,
      message: `Report resolved and action '${resolveReportDto.action}' applied`,
    };
  }

  async getUserSubmittedReports(
    userId: number,
    filter?: string,
    sortOrder: string = 'desc',
  ) {
    const query = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reported', 'reported')
      .leftJoinAndSelect('report.images', 'images')
      .where('reporter.user_id = :userId', { userId });

    if (filter) {
      if (
        filter === 'pending' ||
        filter === 'reviewed' ||
        filter === 'closed'
      ) {
        query.andWhere('report.status = :status', { status: filter });
      } else if (
        filter === 'fake_profile' ||
        filter === 'inappropriate_content' ||
        filter === 'harassment' ||
        filter === 'other' ||
        filter === 'spam'
      ) {
        query.andWhere('report.report_reason = :reason', {
          reason: filter.toLowerCase(),
        });
      }
    }

    // Apply sorting
    const order = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query.orderBy('report.created_at', order);

    const reports = await query.getMany();

    // Transform to match frontend expectations
    return reports.map((report) => ({
      id: String(report.report_id),
      content: report.details || '',
      images: report.images.map(
        (image) => image.thumbnail_url || image.original_url,
      ),
      type: this.mapReportReasonToType(report.report_reason),
      status: this.mapReportStatus(report.status),
      dateReported: report.created_at.toISOString().split('T')[0],
      reportedUser: {
        id: String(report.reported.user_id),
        username:
          report.reported.full_name || `User ${report.reported.user_id}`,
      },
    }));
  }

  // Helper method to map backend report_reason to frontend type
  private mapReportReasonToType(reason: string): string {
    const reasonMap = {
      fake_profile: 'Fake Profile',
      inappropriate_content: 'Inappropriate Content',
      harassment: 'Harassment',
      other: 'Other',
      spam: 'Spam',
    } as any;

    return reasonMap[reason] || reason;
  }

  // Helper method to map backend status to frontend status
  private mapReportStatus(status: string): 'Pending' | 'Resolved' {
    return status === 'pending' ? 'Pending' : 'Resolved';
  }
}
