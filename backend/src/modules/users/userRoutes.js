import { Router } from 'express';
import { userController } from './userController.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.get('/teammates', userController.getTeammates);
router.get('/', userController.searchUsers);
router.get('/:id', userController.getUserById);

export default router;
