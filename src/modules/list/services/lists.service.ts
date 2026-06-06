import { redis } from '../../../config/redis.js';
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
import { ListsRepository } from '../repositories/lists.repository.js';
import {
  CreateListPayload,
  UpdateListPayload,
  ListItemPayload,
  PaginationQuery,
} from '../types/lists.types.js';

export class ListsService {
  static async createList(userId: string, payload: CreateListPayload) {
    const list = await ListsRepository.createList(userId, payload);

    return {
      list_id: list.id,
      name: list.name,
      is_private: list.isPrivate,
      items_count: 0,
    };
  }

  static async getUserLists(userId: string, pagination: PaginationQuery) {
    const lists = await ListsRepository.findUserLists(userId, pagination.page, pagination.limit);

    const nextLists = await ListsRepository.findUserLists(userId, pagination.page + 1, 1);
    const hasNextPage = nextLists.length > 0;

    return {
      pagination: {
        current_page: pagination.page,
        has_next_page: hasNextPage,
      },
      data: lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        is_private: list.isPrivate,
        items_count: list._count.items,
        created_at: list.createdAt.toISOString(),
        updated_at: list.updatedAt.toISOString(),
      })),
    };
  }

  static async getListDetail(userId: string, listId: string) {
    const cacheKey = `list:render:${listId}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      if (parsedData.is_private && parsedData.user_id !== userId) {
        throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
      }
      return parsedData;
    }

    const list = await ListsRepository.findListWithItems(listId);

    if (!list) {
      throw new AppError('List not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (list.isPrivate && list.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const responseData = {
      id: list.id,
      user_id: list.userId,
      name: list.name,
      description: list.description,
      is_private: list.isPrivate,
      created_at: list.createdAt.toISOString(),
      updated_at: list.updatedAt.toISOString(),
      items: list.items.map((item) => ({
        series_id: item.seriesId,
        position: item.position,
        added_at: item.createdAt.toISOString(),
        series: {
          id: item.series.id,
          title: item.series.title,
          poster_url: item.series.posterUrl,
        },
      })),
    };

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 86400);

    return responseData;
  }

  static async updateListMetadata(userId: string, listId: string, payload: UpdateListPayload) {
    const list = await ListsRepository.findListById(listId);

    if (!list) {
      throw new AppError('List not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (list.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const updatedList = await ListsRepository.updateListMetadata(listId, payload);

    await redis.del(`list:render:${listId}`);

    return {
      id: updatedList.id,
      name: updatedList.name,
      description: updatedList.description,
      is_private: updatedList.isPrivate,
      updated_at: updatedList.updatedAt.toISOString(),
    };
  }

  static async deleteList(userId: string, listId: string) {
    const list = await ListsRepository.findListById(listId);

    if (!list) {
      throw new AppError('List not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (list.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await ListsRepository.deleteList(listId);

    await redis.del(`list:render:${listId}`);

    return { message: 'List deleted successfully' };
  }

  static async updateListItems(userId: string, listId: string, items: ListItemPayload[]) {
    const list = await ListsRepository.findListById(listId);

    if (!list) {
      throw new AppError('List not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (list.userId !== userId) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await ListsRepository.updateListItemsTransaction(listId, items);

    await redis.del(`list:render:${listId}`);

    return { message: 'List items updated and reordered successfully.' };
  }
}
