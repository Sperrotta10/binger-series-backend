import { Request, Response } from 'express';
import { SocialService } from '../services/social.service.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { catchAsync } from '../../../utils/catchAsync.js';
import {
  createListSchema,
  feedPaginationSchema,
  listIdParamSchema,
  reviewIdParamSchema,
  toggleFollowSchema,
  updateListItemsSchema,
} from '../schemas/social.schema.js';

export const toggleFollow = catchAsync(async (req: Request, res: Response) => {
  const followerId = req.user!.id;
  const { target_user_id } = toggleFollowSchema.parse(req.body);

  const result = await SocialService.toggleFollow(followerId, target_user_id);
  return ApiResponse.success(res, result);
});

export const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const reviewId = reviewIdParamSchema.parse(req.params.reviewId);

  const result = await SocialService.toggleLikeReview(userId, reviewId);
  return ApiResponse.success(res, result);
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page, limit } = feedPaginationSchema.parse(req.query);

  const result = await SocialService.getFeed(userId, { page, limit });
  return res.status(200).json({
    status: 'success',
    pagination: result.pagination,
    data: result.data,
  });
});

export const createList = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const payload = createListSchema.parse(req.body);

  const result = await SocialService.createList(userId, payload);
  return res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const updateListItems = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listId = listIdParamSchema.parse(req.params.listId);
  const { items } = updateListItemsSchema.parse(req.body);

  const result = await SocialService.updateListItems(userId, listId, items);
  return res.status(200).json({
    status: 'success',
    message: result.message,
  });
});
