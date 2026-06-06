import { prisma } from '../../../config/database.js';
import { ListItemPayload, CreateListPayload, UpdateListPayload } from '../types/lists.types.js';

export class ListsRepository {
  static async createList(userId: string, payload: CreateListPayload) {
    return prisma.list.create({
      data: {
        userId,
        name: payload.name,
        description: payload.description,
        isPrivate: payload.is_private,
      },
    });
  }

  static async findListById(listId: string) {
    return prisma.list.findUnique({ where: { id: listId } });
  }

  static async findListWithItems(listId: string) {
    return prisma.list.findUnique({
      where: { id: listId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            series: true,
          },
        },
      },
    });
  }

  static async findUserLists(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    return prisma.list.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  static async updateListItemsTransaction(listId: string, items: ListItemPayload[]) {
    return prisma.$transaction(async (tx) => {
      await tx.listItem.deleteMany({
        where: { listId },
      });

      if (items && items.length > 0) {
        const insertData = items.map((item) => ({
          listId,
          seriesId: item.series_id,
          position: item.position,
        }));
        await tx.listItem.createMany({
          data: insertData,
        });
      }
    });
  }

  static async updateListMetadata(listId: string, payload: UpdateListPayload) {
    const data: Parameters<typeof prisma.list.update>[0]['data'] = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.is_private !== undefined) data.isPrivate = payload.is_private;

    return prisma.list.update({
      where: { id: listId },
      data,
    });
  }

  static async deleteList(listId: string) {
    return prisma.list.delete({
      where: { id: listId },
    });
  }
}
