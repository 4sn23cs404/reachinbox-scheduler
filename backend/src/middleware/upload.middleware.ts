import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 5;

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.csv', '.txt'];

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type "${ext}". Only .csv and .txt recipient lead files are permitted.`
      )
    );
  }
};

export const uploadRecipientsFile = multer({
  storage,
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024,
  },
  fileFilter,
});
