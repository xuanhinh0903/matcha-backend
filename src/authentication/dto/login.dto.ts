import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export default class LoginDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
