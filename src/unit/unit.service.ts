import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitService {
  constructor(
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
  ) {}

  async create(dto: CreateUnitDto): Promise<Unit> {
    const unit = this.unitRepository.create(dto);
    return this.unitRepository.save(unit);
  }

  async findAll(): Promise<Unit[]> {
    return this.unitRepository.find({ relations: ['parent', 'children'] });
  }

  async findOne(id: number): Promise<Unit | null> {
    return this.unitRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'users', 'targets'],
    });
  }

  async update(id: number, dto: UpdateUnitDto): Promise<Unit | null> {
    await this.unitRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.unitRepository.delete(id);
  }
}
