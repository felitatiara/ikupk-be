import { IsEmail, IsOptional, IsString, Length, IsInt } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nip?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nama?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Length(4, 100)
  password?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  unitId?: number | null;
}
