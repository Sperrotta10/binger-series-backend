import { Request, Response } from 'express';
import { ListsService } from '../services/lists.service.js';
import { catchAsync } from '../../../utils/catchAsync.js';
import {
  createListSchema,
  listIdParamSchema,
  listsPaginationSchema,
  updateListItemsSchema,
  updateListSchema,
} from '../schemas/lists.schema.js';

export const createList = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const payload = createListSchema.parse(req.body);

  const result = await ListsService.createList(userId, payload);
  return res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const getMyLists = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const pagination = listsPaginationSchema.parse(req.query);

  const result = await ListsService.getUserLists(userId, pagination);
  return res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: result.data,
  });
});

export const getListDetail = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listId = listIdParamSchema.parse(req.params.listId);

  const result = await ListsService.getListDetail(userId, listId);
  return res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const updateListMetadata = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listId = listIdParamSchema.parse(req.params.listId);
  const payload = updateListSchema.parse(req.body);

  const result = await ListsService.updateListMetadata(userId, listId, payload);
  return res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const deleteList = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listId = listIdParamSchema.parse(req.params.listId);

  await ListsService.deleteList(userId, listId);
  return res.status(204).send();
});

export const updateListItems = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listId = listIdParamSchema.parse(req.params.listId);
  const { items } = updateListItemsSchema.parse(req.body);

  const result = await ListsService.updateListItems(userId, listId, items);
  return res.status(200).json({
    status: 'success',
    message: result.message,
  });
});
