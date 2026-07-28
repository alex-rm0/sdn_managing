import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAdmin } from "../middlewares/auth";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, "_")
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024 } });

const router: IRouter = Router();

router.post(
  "/documents/upload",
  requireAdmin,
  upload.single("file"),
  (req, res): void => {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum ficheiro enviado" });
      return;
    }
    res.json({ url: `/api/uploads/${req.file.filename}` });
  }
);

export default router;
