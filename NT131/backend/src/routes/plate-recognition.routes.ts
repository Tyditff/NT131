import express from "express";
import multer from "multer";
import asyncHandler from "../middlewares/error-handling/async-handler.middleware";
import AppError from "../utills/app-error";
import { detectPlate } from "../services/plate-recognition.service";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/predict",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError("file is required", 400);
    }

    const result = await detectPlate(req.file.buffer);
    res.status(200).json(result);
  }),
);

router.post(
  "/esp32",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError("file is required", 400);
    }

    const result = await detectPlate(req.file.buffer);
    const predictions = Array.isArray(result?.predictions)
      ? result.predictions
      : [];
    const topPrediction = predictions.length > 0 ? predictions[0] : null;

    res.status(200).json({
      detected: Boolean(topPrediction),
      top_prediction: topPrediction,
      predictions,
    });
  }),
);

export default router;
