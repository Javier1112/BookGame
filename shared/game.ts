export interface GameOption {
  label: string;
  text: string;
}

export interface GameHistoryEntry {
  round: number;
  label: string;
  text: string;
}

export interface GameTurnRequest {
  bookTitle: string;
  round: number;
  choice: string | null;
  history: GameHistoryEntry[];
}

export interface GameTurnResponse {
  characterName: string;
  sceneDescription: string;
  imagePrompt: string;
  imageUrl: string;
  options: GameOption[];
  isGameOver: boolean;
}
