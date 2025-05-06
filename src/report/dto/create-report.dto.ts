import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  @IsNumber()
  reportedUserId: number;

  @IsNotEmpty()
  @IsEnum(['fake_profile', 'inappropriate_content', 'harassment', 'other'])
  reportReason: string;

  @IsOptional()
  @IsString()
  details?: string;
}
