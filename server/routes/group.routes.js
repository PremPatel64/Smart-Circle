import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  leaveGroup
} from '../controllers/group.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all group endpoints

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:id', getGroupDetails);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);
router.post('/:id/members', addMembers);
router.delete('/:id/members/:memberId', removeMember);
router.delete('/:id/leave', leaveGroup);

export default router;
