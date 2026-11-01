import { Router } from 'express';
import { friendController } from './friendController.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', friendController.sendFriendRequest);
router.post('/request', friendController.sendFriendRequest);
router.get('/requests', friendController.getFriendRequests);
router.post('/requests/:id/accept', friendController.acceptFriendRequest);
router.post('/requests/:id/reject', friendController.rejectFriendRequest);
router.delete('/requests/:id', friendController.cancelFriendRequest);

router.get('/', friendController.getFriends);
router.delete('/:friendId', friendController.removeFriend);
router.get('/:friendId/messages', friendController.getDirectMessages);

export default router;
