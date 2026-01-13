import type { GameTurnRequest, GameTurnResponse } from "@shared/game";

const normalizeBaseUrl = (url: string | undefined) => {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `http://${normalized}`;
};

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const PLAY_TURN_ENDPOINT = "/api/play-turn";

export const fetchGameTurn = async (
  payload: GameTurnRequest
): Promise<GameTurnResponse> => {
  const response = await fetch(`${API_BASE_URL}${PLAY_TURN_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "无法生成新的章节，请稍后再试。");
  }

  return (await response.json()) as GameTurnResponse;
};
