import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import GameScreen from "@/components/GameScreen";
import StartScreen from "@/components/StartScreen";
import { PRESET_BOOKS } from "@/constants/books";
import { useGameEngine } from "@/hooks/useGameEngine";

import "@/styles/globals.css";
import "@/styles/animations.css";

const App = () => {
  const {
    gameState,
    loading,
    progress,
    loadingMessage,
    error,
    lastImageUrl,
    displayedSceneDescription,
    revealedOptions,
    interactionLocked,
    startGame,
    chooseOption,
    resetGame
  } = useGameEngine();
  const [inputBook, setInputBook] = useState("");

  const handleStart = (title: string) => {
    if (!title.trim()) {
      return;
    }
    startGame(title);
    setInputBook("");
  };

  const content = gameState ? (
    <GameScreen
      state={gameState}
      loading={loading}
      interactionLocked={interactionLocked}
      lastImageUrl={lastImageUrl}
      displayedSceneDescription={displayedSceneDescription}
      revealedOptions={revealedOptions}
      onRestart={resetGame}
      onChoose={chooseOption}
      error={error}
    />
  ) : (
    <StartScreen
      inputBook={inputBook}
      onInputChange={setInputBook}
      onStart={handleStart}
      loading={loading}
      loadingMessage={loadingMessage}
      progress={progress}
      error={error}
      books={PRESET_BOOKS}
    />
  );

  return content;
};

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
