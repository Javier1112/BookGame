import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
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
  const protagonistName = (body as Record<string, unknown>).protagonistName;
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
    history,
    protagonistName:
      typeof protagonistName === "string" && protagonistName.trim()
        ? protagonistName.trim()
        : null
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
  const maxInFlightPerClient = Math.max(
    1,
    Number(process.env.PLAY_TURN_MAX_INFLIGHT_PER_IP ?? 1)
  );
  const inFlightByClient = new Map<string, number>();

  const getClientKey = (req: Request) => {
    const forwardedFor =
      typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
        : null;
    return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
  };

  router.post("/play-turn", async (req, res) => {
    const clientKey = getClientKey(req);
    const activeCount = inFlightByClient.get(clientKey) ?? 0;
    if (activeCount >= maxInFlightPerClient) {
      logJson("warn", "play_turn_rejected_busy", { clientKey, activeCount });
      return res.status(429).send("请求过于频繁：上一回合仍在生成中，请稍后再试。");
    }
    inFlightByClient.set(clientKey, activeCount + 1);

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
    } finally {
      const current = inFlightByClient.get(clientKey) ?? 0;
      const next = Math.max(0, current - 1);
      if (next === 0) inFlightByClient.delete(clientKey);
      else inFlightByClient.set(clientKey, next);
    }
  });

  router.get("/health", (_, res) => {
    res.json({ status: "ok" });
  });

  return router;
};
