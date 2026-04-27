import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nip?: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  nama: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Length(4, 100)
  password: string;

  @IsOptional()
  @IsString()
  jenis?: string;

  // ID role utama yang akan menjadi is_primary = true
  @IsOptional()
  @IsInt()
  roleId?: number | null;

  // Tambahan role (selain primary), opsional
  @IsOptional()
  extraRoleIds?: number[];

  @IsOptional()
  @IsInt()
  atasanId?: number | null;
}
