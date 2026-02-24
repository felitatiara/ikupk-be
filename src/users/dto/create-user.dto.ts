import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  nama: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Length(4, 100)
  password: string;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsInt()
  unitId?: number | null;
}
