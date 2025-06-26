import { IsEmail, IsNotEmpty, IsOptional, IsString, IsStrongPassword, IsBoolean } from 'class-validator';
import { Point } from 'geojson';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsStrongPassword()
  password?: string;

  @IsOptional()
  @IsString()
  firebase_uid?: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @IsOptional()
  location?: Point;
}

export default CreateUserDto;
