import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateInterestDto {
  @IsString()
  @IsNotEmpty()
  interest_name: string;
}
