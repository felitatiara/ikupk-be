import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Disposisi } from './disposisi.entity';
import { UserRelation } from '../users/user_relation.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';

@Injectable()
export class DisposisiService {
  private readonly logger = new Logger(DisposisiService.name);

  constructor(
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
    @InjectRepository(UserRelation)
    private userRelationRepo: Repository<UserRelation>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
  ) {}

  async findByIndikator(
    indikatorId: number,
    tahun: string,
    fromUserId?: number | null,
  ): Promise<Disposisi[]> {
    const where: any = { indikatorId, tahun };
    if (fromUserId !== undefined) {
      where.fromUserId = fromUserId;
    }
    return this.disposisiRepo.find({
      where,
      relations: ['toUser', 'toUser.userRoles', 'toUser.userRoles.role', 'fromUser', 'fromUser.userRoles', 'fromUser.userRoles.role', 'parent'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Total jumlahTarget yang diterima toUserId untuk indikator ini.
   * Dipakai untuk validasi agar re-disposisi tidak melebihi yang diterima.
   */
  async getReceivedJumlah(
    toUserId: number,
    indikatorId: number,
    tahun: string,
  ): Promise<number> {
    const received = await this.disposisiRepo.find({
      where: { toUserId, indikatorId, tahun },
    });
    if (received.length === 0) return 0;
    // Prefer explicit disposisi (fromUserId != null) over auto-cascade (fromUserId = null).
    // Use SUM so a pimpinan who receives from multiple WD/senders (cascade import from
    // multiple prodi sheets) can re-distribute the full combined amount.
    const explicit = received.filter((d) => d.fromUserId !== null);
    const toUse = explicit.length > 0 ? explicit : received;
    return toUse.reduce((sum, d) => sum + Number(d.jumlahTarget), 0);
  }

  /**
   * Simpan/update batch disposisi dari satu user ke banyak user.
   * Disposisi lama dari fromUserId untuk indikator+tahun yang sama akan dihapus dulu.
   */
  async upsertMultiple(
    indikatorId: number,
    tahun: string,
    items: { toUserId: number; jumlahTarget: number }[],
    fromUserId?: number | null,
    parentId?: number | null,
    skipValidation = false,
  ): Promise<Disposisi[]> {
    if (fromUserId && !skipValidation) {
      const received = await this.getReceivedJumlah(fromUserId, indikatorId, tahun);
      if (received > 0) {
        const totalRequested = items.reduce((sum, i) => sum + i.jumlahTarget, 0);
        if (totalRequested > received) {
          throw new BadRequestException(
            `Total disposisi (${totalRequested}) melebihi jumlah yang Anda terima (${received})`,
          );
        }
      }
    }

    const deleteQb = this.disposisiRepo
      .createQueryBuilder()
      .delete()
      .where('indikator_id = :indikatorId', { indikatorId })
      .andWhere('tahun = :tahun', { tahun });

    if (fromUserId) {
      deleteQb.andWhere('from_user_id = :fromUserId', { fromUserId });
    } else {
      deleteQb.andWhere('from_user_id IS NULL');
    }

    try {
      await deleteQb.execute();
    } catch (err: any) {
      this.logger.error(`DELETE failed [indId=${indikatorId} from=${fromUserId ?? 'null'}]: ${err?.message}`, err?.stack);
      throw new InternalServerErrorException(`Gagal menghapus disposisi lama: ${err?.message ?? err}`);
    }

    // Resolve parentId AFTER delete so we always find the freshly-created parent record,
    // not a stale record from a previous import that might have been deleted by an
    // earlier step in the same cascade run.
    let resolvedParentId = parentId ?? null;
    if (fromUserId && resolvedParentId === null) {
      const parentDisposisi = await this.disposisiRepo.findOne({
        where: { toUserId: fromUserId, indikatorId, tahun },
        order: { id: 'ASC' },
      });
      resolvedParentId = parentDisposisi?.id ?? null;
    }

    const entities = items
      .filter((item) => item.jumlahTarget > 0 && item.toUserId)
      .map((item) =>
        this.disposisiRepo.create({
          indikatorId,
          tahun,
          toUserId: item.toUserId,
          jumlahTarget: item.jumlahTarget,
          fromUserId: fromUserId ?? null,
          parentId: resolvedParentId,
          status: 'diterima',
        }),
      );

    if (entities.length === 0) return [];
    try {
      return await this.disposisiRepo.save(entities);
    } catch (err: any) {
      this.logger.error(
        `INSERT failed [indId=${indikatorId} from=${fromUserId ?? 'null'} parentId=${resolvedParentId ?? 'null'} items=${JSON.stringify(entities.map(e => ({ toUserId: e.toUserId, jumlahTarget: e.jumlahTarget })))}]: ${err?.message}`,
        err?.stack,
      );
      throw new InternalServerErrorException(`Gagal menyimpan disposisi [parentId=${resolvedParentId ?? 'null'}]: ${err?.message ?? err}`);
    }
  }

  /**
   * Ambil seluruh rantai disposisi di bawah sebuah parentId (untuk rollup capaian).
   */
  async findChain(parentId: number): Promise<Disposisi[]> {
    return this.disposisiRepo.find({
      where: { parentId },
      relations: ['toUser', 'toUser.userRoles', 'toUser.userRoles.role'],
    });
  }

  async remove(id: number): Promise<void> {
    await this.disposisiRepo.delete(id);
  }

  /**
   * Kembalikan daftar bawahan langsung (berdasarkan UserRelation) beserta
   * jumlah yang sudah mereka terima untuk indikator tertentu.
   * Juga mengembalikan berapa yang diterima oleh fromUserId sendiri.
   */
  async getBawahanForDisposisi(fromUserId: number, indikatorId: number, tahun: string) {
    // Gunakan QueryBuilder dengan explicit column name untuk menghindari
    // potensi property-mapping issue pada TypeORM find()
    const rels = await this.userRelationRepo
      .createQueryBuilder('ur')
      .where('ur.parent_id = :parentId', { parentId: fromUserId })
      .getMany();

    this.logger.debug(
      `getBawahanForDisposisi: fromUserId=${fromUserId} → found ${rels.length} relations [${rels.map(r => r.userId).join(',')}]`,
    );

    const bawahanIds = rels.map((r) => r.userId);

    if (bawahanIds.length === 0) {
      const myReceived = await this.getReceivedJumlah(fromUserId, indikatorId, tahun);
      return { myReceived, bawahan: [] };
    }

    const [users, userRoles] = await Promise.all([
      this.userRepo.find({ where: { id: In(bawahanIds) } }),
      this.userRoleRepo.find({
        where: bawahanIds.map((id) => ({ userId: id, isPrimary: true })),
        relations: ['role'],
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const roleMap = new Map<number, string>();
    for (const ur of userRoles) {
      if (!roleMap.has(ur.userId)) roleMap.set(ur.userId, ur.role?.name ?? '');
    }

    const bawahan: { userId: number; nama: string; jabatan: string; receivedJumlah: number }[] = [];
    for (const bawahanId of bawahanIds) {
      const u = userMap.get(bawahanId);
      if (!u) continue;
      const receivedJumlah = await this.getReceivedJumlah(bawahanId, indikatorId, tahun);
      bawahan.push({
        userId: bawahanId,
        nama: u.nama,
        jabatan: roleMap.get(bawahanId) ?? '',
        receivedJumlah,
      });
    }

    const myReceived = await this.getReceivedJumlah(fromUserId, indikatorId, tahun);
    return { myReceived, bawahan };
  }

  async debugRelationsFor(parentId: number) {
    const rels = await this.userRelationRepo
      .createQueryBuilder('ur')
      .where('ur.parent_id = :parentId', { parentId })
      .getMany();
    return {
      parentId,
      count: rels.length,
      children: rels.map((r) => ({ relationId: r.id, userId: r.userId, parentId: r.parentId })),
    };
  }
}
