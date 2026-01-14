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
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [displayedSceneDescription, setDisplayedSceneDescription] = useState("");
  const [revealedOptions, setRevealedOptions] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const interactionLockedRef = useRef(false);
  const lastActionRef = useRef(0);
  const typingTimeoutRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (!gameState?.sceneDescription) {
      setDisplayedSceneDescription("");
      setIsTypingComplete(false);
      return;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const fullText = gameState.sceneDescription;
    let index = 0;
    setDisplayedSceneDescription("");
    setIsTypingComplete(false);

    const step = () => {
      index += 1;
      setDisplayedSceneDescription(fullText.slice(0, index));

      if (index >= fullText.length) {
        setIsTypingComplete(true);
        typingTimeoutRef.current = null;
        return;
      }

      const char = fullText[index - 1] ?? "";
      const delay =
        /[。！？!?]/.test(char) ? 220 : /[，,；;]/.test(char) ? 120 : 35;
      typingTimeoutRef.current = window.setTimeout(step, delay);
    };

    typingTimeoutRef.current = window.setTimeout(step, 60);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [gameState?.sceneDescription]);

  useEffect(() => {
    if (!gameState || loading || gameState.isGameOver) {
      setRevealedOptions(0);
      return;
    }

    if (!isTypingComplete) {
      setRevealedOptions(0);
      return;
    }

    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }

    const totalOptions = gameState.options?.length ?? 0;
    if (totalOptions === 0) {
      setRevealedOptions(0);
      return;
    }

    let index = 0;
    setRevealedOptions(0);
    const step = () => {
      index += 1;
      setRevealedOptions(index);
      if (index >= totalOptions) {
        revealTimeoutRef.current = null;
        return;
      }
      revealTimeoutRef.current = window.setTimeout(step, 120);
    };

    revealTimeoutRef.current = window.setTimeout(step, 60);

    return () => {
      if (revealTimeoutRef.current) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, [gameState, isTypingComplete, loading]);

  const executeTurn = useCallback(
    async (payload: GameTurnRequest) => {
      const now = Date.now();
      if (inFlightRef.current || now - lastActionRef.current < REQUEST_DEBOUNCE_MS) {
        return;
      }
      inFlightRef.current = true;
      interactionLockedRef.current = true;
      setInteractionLocked(true);
      lastActionRef.current = now;
      setRevealedOptions(0);
      setIsTypingComplete(false);
      if (revealTimeoutRef.current) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      setLastImageUrl(gameState?.imageUrl ?? null);
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

        if (gameState) {
          setIsTypingComplete(true);
          setRevealedOptions(gameState.options?.length ?? 0);
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
          interactionLockedRef.current = false;
          setInteractionLocked(false);
        }
      }
    },
    [gameState]
  );

  const startGame = useCallback(
    (bookTitle: string) => {
      const sanitized = bookTitle.trim();
      if (!sanitized || loading || interactionLockedRef.current) {
        return;
      }

      setLastImageUrl(null);
      executeTurn({
        bookTitle: sanitized,
        round: 0,
        choice: null,
        history: [],
        protagonistName: null
      });
    },
    [executeTurn, loading]
  );

  const chooseOption = useCallback(
    (option: GameOption) => {
      if (
        !gameState ||
        loading ||
        interactionLockedRef.current ||
        gameState.isGameOver
      ) {
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
        history: updatedHistory,
        protagonistName: gameState.characterName
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
    setLastImageUrl(null);
    setDisplayedSceneDescription("");
    setRevealedOptions(0);
    setIsTypingComplete(false);
    setInteractionLocked(false);
    inFlightRef.current = false;
    interactionLockedRef.current = false;
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }, []);

  return {
    gameState,
    loading,
    progress,
    loadingMessage: LOADING_MESSAGES[loadingMsgIdx],
    error,
    lastImageUrl,
    displayedSceneDescription,
    revealedOptions,
    interactionLocked,
    startGame,
    chooseOption,
    resetGame
  };
};
