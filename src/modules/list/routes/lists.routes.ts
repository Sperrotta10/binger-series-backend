import { Router } from 'express';
import { authenticate } from '../../../middlewares/authenticate.js';
import {
  createList,
  deleteList,
  getListDetail,
  getMyLists,
  updateListItems,
  updateListMetadata,
} from '../controllers/lists.controller.js';

const router: Router = Router();

// All lists endpoints require authentication
router.use(authenticate);

router.post('/', createList);
router.get('/me', getMyLists);
router.get('/:listId', getListDetail);
router.put('/:listId', updateListMetadata);
router.delete('/:listId', deleteList);
router.put('/:listId/items', updateListItems);

export { router as listsRouter };
