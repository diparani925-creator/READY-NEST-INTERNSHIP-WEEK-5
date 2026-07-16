import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize original file name to remove special chars or spaces
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${cleanName}`);
  },
});

// Profile image upload filter: JPEG, PNG, WEBP, GIF (Max 2MB)
export const profileUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF formats are allowed.'));
    }
  },
});

// Workspace attachments upload filter: PDF, Office docs, text, images, ZIP (Max 10MB)
export const attachmentUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported formats: PDF, ZIP, txt, CSV, Word, Excel, or standard images.'));
    }
  },
});
export { UPLOAD_DIR };
