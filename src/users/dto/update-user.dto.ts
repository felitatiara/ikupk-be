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
  jenis?: string;

  // Ganti primary role user
  @IsOptional()
  @IsInt()
  roleId?: number | null;

  // Ganti semua non-primary roles; jika diisi, replace seluruh extra roles
  @IsOptional()
  extraRoleIds?: number[];

  @IsOptional()
  @IsInt()
  atasanId?: number | null;

  // Multiple atasan; jika diisi, mengoverride atasanId
  @IsOptional()
  atasanIds?: number[];
}
