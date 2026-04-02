import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('by-unit')
  findByUnit(@Query('unitId', ParseIntPipe) unitId: number) {
    return this.usersService.findByUnit(unitId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('login')
  async login(@Body() body: { identifier: string; password: string }) {
    const { identifier, password } = body;
    const result = await this.usersService.validateCredentials(
      identifier,
      password,
    );
    if (!result.user) throw new NotFoundException('Invalid credentials');
    // For now return user (without password)
    // Strip password before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...rest } = result.user;
    return rest;
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.remove(id);
    return { deleted: true };
  }
}
