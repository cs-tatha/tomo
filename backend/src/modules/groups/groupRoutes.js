import { Router } from 'express';
import { groupController } from './groupController.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', groupController.createGroup);
router.get('/', groupController.getMyGroups);

// Workspace Invitations (defined before /:id to prevent route collision)
router.get('/invitations/my', groupController.getMyInvitations);
router.post('/invitations/:id/accept', groupController.acceptInvitation);
router.post('/invitations/:id/reject', groupController.rejectInvitation);

// Workspace by ID and workspace actions
router.get('/:id', groupController.getGroupById);
router.delete('/:id', groupController.deleteGroup);
router.post('/:id/members', groupController.inviteMember);
router.post('/:id/invitations', groupController.inviteMember);
router.delete('/:id/members/:userId', groupController.removeMember);
router.get('/:id/messages', groupController.getGroupMessages);

export default router;
