import * as dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import checkConnection from "./config/database.ts";
import errorHandler from "./middlewares/error-handling/error-handler.middleware.ts";
import {
  authRateLimiter,
  apiRateLimiter,
} from "./middlewares/security/rate-limit.middleware.ts";
import apiRouter from "./routes/index.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

app.use(express.json());
app.use(express.static(publicDir));

app.use("/api/v1", apiRateLimiter);
app.use("/api/v1/auth", authRateLimiter);
app.use("/api/v1", apiRouter);
app.use(errorHandler);

const startServer = async () => {
  try {
    await checkConnection();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
};

startServer();
