import type { GameHistoryEntry, GameOption } from "@shared/game";

export interface GameState {
  round: number;
  bookTitle: string;
  characterName: string;
  sceneDescription: string;
  imagePrompt: string;
  imageUrl: string;
  options: GameOption[];
  history: GameHistoryEntry[];
  isGameOver: boolean;
  isVictory: boolean;
  libraryLink: string;
}
