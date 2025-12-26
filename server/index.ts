import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServerConfig } from "./config/env.js";
import { createGameRouter } from "./routes/game.js";

const bootstrap = async () => {
  dotenv.config();
  dotenv.config({ path: ".env.local", override: true });

  const config = createServerConfig();
  const app = express();

  const corsOptions = {
    origin:
      config.allowedOrigins.length > 0
        ? config.allowedOrigins
        : [/^http:\/\/localhost:\d+$/],
    credentials: false
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api",
    createGameRouter(
      config.zhipuTextApiKey,
      config.imageApiKey
    )
  );

  app.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  app.listen(config.port, () => {
    console.log(
      `SHNU Playbrary API 已在端口 ${config.port} 启动，允许来源: ${
        config.allowedOrigins.length > 0
          ? config.allowedOrigins.join(", ")
          : "localhost"
      }`
    );
  });
};

bootstrap().catch((error) => {
  console.error("启动服务器失败", error);
  process.exit(1);
});
