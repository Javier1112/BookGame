import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { GameHistoryEntry, GameTurnRequest } from "../../shared/game.js";
import { createZhipuGameService } from "../services/zhipuService.js";
import { logJson } from "../utils/logger.js";

class ValidationError extends Error {}

const sanitizeHistory = (raw: unknown): GameHistoryEntry[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const roundValue = Number((entry as Record<string, unknown>).round);
      const labelValue = (entry as Record<string, unknown>).label;
      const textValue = (entry as Record<string, unknown>).text;

      if (Number.isNaN(roundValue)) return null;

      return {
        round: roundValue,
        label: typeof labelValue === "string" ? labelValue : "?",
        text: typeof textValue === "string" ? textValue : ""
      };
    })
    .filter((entry): entry is GameHistoryEntry => entry !== null);
};

const validatePayload = (body: unknown): GameTurnRequest => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("请求体格式不正确。");
  }

  const bookTitle = (body as Record<string, unknown>).bookTitle;
  const round = Number((body as Record<string, unknown>).round ?? 0);
  const choice = (body as Record<string, unknown>).choice;
  const history = sanitizeHistory(
    (body as Record<string, unknown>).history ?? []
  );

  if (typeof bookTitle !== "string" || !bookTitle.trim()) {
    throw new ValidationError("bookTitle 字段不能为空。");
  }

  return {
    bookTitle: bookTitle.trim(),
    round: Number.isNaN(round) ? 0 : Math.max(0, round),
    choice: typeof choice === "string" ? choice : null,
    history
  };
};

export const createGameRouter = (
  zhipuTextApiKey: string,
  imageApiKey: string
) => {
  const router = Router();
  const zhipuService = createZhipuGameService(
    zhipuTextApiKey,
    imageApiKey
  );

  router.post("/play-turn", async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    try {
      const payload = validatePayload(req.body);
      logJson("info", "play_turn_start", {
        requestId,
        round: payload.round,
        historyCount: payload.history.length
      });
      const result = await zhipuService.generateTurn(payload, requestId);
      logJson("info", "play_turn_ok", {
        requestId,
        ms: Date.now() - startedAt
      });
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        logJson("warn", "play_turn_bad_request", {
          requestId,
          ms: Date.now() - startedAt
        });
        return res.status(400).send(error.message);
      }

      const err =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: String(error ?? "unknown") };
      logJson("error", "play_turn_failed", {
        requestId,
        ms: Date.now() - startedAt,
        error: err
      });
      res.status(500).send(
        error instanceof Error ? error.message : "故事生成失败，请稍后再试。"
      );
    }
  });

  router.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  return router;
};
