import { useCallback, useEffect, useRef, useState } from "react";
import { LOADING_MESSAGES } from "@/constants/loadingMessages";
import { MAX_ROUNDS } from "@/constants/gameConfig";
import { fetchGameTurn } from "@/services/gameService";
import type { GameOption, GameTurnRequest } from "@shared/game";
import type { GameState } from "@/types/game";
import { buildLibraryLink } from "@/utils/library";
import { howCustomToast } from "@/utils/toast";

export const useGameEngine = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastActionRef = useRef(0);
  const REQUEST_DEBOUNCE_MS = 800;

  useEffect(() => {
    if (!loading) {
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) {
          return prev;
        }

        let increment = 0;
        if (prev < 20) {
          increment = Math.random() * 5;
        } else if (prev < 50) {
          increment = Math.random() * 2;
        } else if (prev < 80) {
          increment = Math.random() * 1;
        } else {
          increment = Math.random() * 0.3;
        }

        const nextValue = prev + increment;
        return nextValue > 99 ? 99 : nextValue;
      });
    }, 200);

    return () => window.clearInterval(timer);
  }, [loading]);

  const executeTurn = useCallback(
    async (payload: GameTurnRequest) => {
      const now = Date.now();
      if (inFlightRef.current || now - lastActionRef.current < REQUEST_DEBOUNCE_MS) {
        return;
      }
      inFlightRef.current = true;
      lastActionRef.current = now;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(null);

      try {
        const response = await fetchGameTurn(payload);

        if (requestId !== requestIdRef.current) {
          return;
        }

        const nextRound = payload.round + 1;
        const isFinalRound = nextRound >= MAX_ROUNDS;
        const isGameOver = response.isGameOver || isFinalRound;
        const isVictory = isFinalRound && !response.isGameOver;

        setGameState({
          round: nextRound,
          bookTitle: payload.bookTitle,
          characterName: response.characterName,
          sceneDescription: response.sceneDescription,
          imagePrompt: response.imagePrompt,
          imageUrl: response.imageUrl,
          options: response.options,
          history: payload.history,
          isGameOver,
          isVictory,
          libraryLink: buildLibraryLink(payload.bookTitle)
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error(err);
        const message =
          err instanceof Error
            ? err.message
            : "生成故事时遇到未知错误，请稍后再试。";
        const isRateLimited =
          message.includes("429") ||
          message.includes("Too Many Requests") ||
          message.includes("请求过多");
        if (isRateLimited) {
          howCustomToast(
            "系统繁忙",
            "我们正在为您生成精彩故事，请稍等片刻再尝试",
            "⏳"
          );
          setError("我们正在为您生成精彩故事，请稍等片刻再尝试。");
        } else {
          setError(message);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          inFlightRef.current = false;
        }
      }
    },
    []
  );

  const startGame = useCallback(
    (bookTitle: string) => {
      const sanitized = bookTitle.trim();
      if (!sanitized || loading) {
        return;
      }

      executeTurn({
        bookTitle: sanitized,
        round: 0,
        choice: null,
        history: []
      });
    },
    [executeTurn, loading]
  );

  const chooseOption = useCallback(
    (option: GameOption) => {
      if (!gameState || loading || gameState.isGameOver) {
        return;
      }

      const updatedHistory = [
        ...gameState.history,
        {
          round: gameState.round,
          label: option.label,
          text: option.text
        }
      ];

      executeTurn({
        bookTitle: gameState.bookTitle,
        round: gameState.round,
        choice: option.text,
        history: updatedHistory
      });
    },
    [executeTurn, gameState, loading]
  );

  const resetGame = useCallback(() => {
    requestIdRef.current += 1;
    setGameState(null);
    setError(null);
    setProgress(0);
    setLoading(false);
    inFlightRef.current = false;
  }, []);

  return {
    gameState,
    loading,
    progress,
    loadingMessage: LOADING_MESSAGES[loadingMsgIdx],
    error,
    startGame,
    chooseOption,
    resetGame
  };
};
