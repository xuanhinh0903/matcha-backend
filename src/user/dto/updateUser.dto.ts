import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class GeoPoint {
  @IsEnum(['Point'])
  type: 'Point';

  @IsOptional()
  @IsString({ each: true })
  coordinates: [number, number];
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  birthdate?: Date;

  @IsOptional()
  @IsEnum(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPoint)
  location?: GeoPoint;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsBoolean()
  is_banned?: boolean;

  @IsOptional()
  @IsString()
  ban_reason?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  banned_at?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  ban_expires_at?: Date;
}
