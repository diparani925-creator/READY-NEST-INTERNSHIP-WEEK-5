import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  uploadProfileImage,
  uploadAttachment,
  getAttachments,
  deleteAttachment,
} from '../controllers/uploadController';
import { profileUpload, attachmentUpload } from '../config/uploadConfig';

const router = Router();

// Protect all upload routes with authentication
router.use(authenticate);

router.post('/profile', profileUpload.single('file'), uploadProfileImage);
router.post('/attachment', attachmentUpload.single('file'), uploadAttachment);
router.get('/attachments', getAttachments);
router.delete('/attachments/:id', deleteAttachment);

export default router;
