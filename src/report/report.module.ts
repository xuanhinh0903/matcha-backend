import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { User } from 'src/user/entities/user.entity';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ReportImage } from './entities/report-image.entity';
import { CloudinaryService } from 'src/utils/cloudinary/cloudinary.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, User, ReportImage])],
  controllers: [ReportController],
  providers: [ReportService, CloudinaryService],
  exports: [ReportService],
})
export class ReportModule {}
