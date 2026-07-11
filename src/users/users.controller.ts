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
import { EventsService } from '../events/events.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
  ) {}

  // ── Read-only endpoints ───────────────────────────────────────────────────

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Get('roles')
  findAllRoles() { return this.usersService.findAllRoles(); }

  @Post('roles')
  createRole(@Body() body: { name: string; unitNama: string; level: number }) {
    return this.usersService.createRole(body);
  }

  @Put('roles/:id')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; unitNama?: string; level?: number }) {
    return this.usersService.updateRole(id, body);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteRole(id);
  }

  @Get('by-role')
  findByRole(@Query('roleId', ParseIntPipe) roleId: number) {
    return this.usersService.findByRole(roleId);
  }

  @Get('related')
  findRelatedUsers(@Query('userId', ParseIntPipe) userId: number) {
    return this.usersService.findRelatedUsersFor(userId);
  }

  @Get('debug-relations')
  debugRelations(@Query('parentId', ParseIntPipe) parentId: number) {
    return this.usersService.debugRelations(parentId);
  }

  @Get('has-related')
  async hasRelatedUsers(@Query('userId', ParseIntPipe) userId: number) {
    const has = await this.usersService.hasRelatedUsers(userId);
    return { hasRelated: has };
  }

  @Get('all-bawahan')
  findAllBawahan(@Query('userId', ParseIntPipe) userId: number) {
    return this.usersService.findAllBawahanFor(userId);
  }

  @Get('dosen-by-unit')
  findDosenByUnit(@Query('unitNama') unitNama: string) {
    return this.usersService.findDosenByUnit(unitNama);
  }

  @Get('all-dosen')
  findAllDosen() { return this.usersService.findAllDosen(); }

  @Get('by-level')
  findByRoleLevel(@Query('level', ParseIntPipe) level: number) {
    return this.usersService.findByRoleLevel(level);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const result = await this.usersService.create(createUserDto);
    this.eventsService.emit('user', 'created', result.id);
    return result;
  }

  @Post('login')
  async login(@Body() body: { identifier: string; password: string }) {
    const { identifier, password } = body;
    const result = await this.usersService.validateCredentials(identifier, password);
    if (!result.user) throw new NotFoundException('Invalid credentials');
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
    this.eventsService.emit('user', 'updated', id);
    return user;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersService.remove(id);
    this.eventsService.emit('user', 'deleted', id);
    return { deleted: true };
  }
}
