import type { GameTurnRequest, GameTurnResponse } from "@shared/game";

const normalizeBaseUrl = (url: string | undefined) => {
  if (!url) {
    return "";
  }

  return url.endsWith("/") ? url.slice(0, -1) : url;
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
