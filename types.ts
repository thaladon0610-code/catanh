export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  original: string; // Base64
  generated: string; // Base64 (Transparent)
  promptUsed: string;
  thumbnail: string; // Small preview
}

export interface PresetPrompt {
  id: string;
  label: string;
  text: string;
  description: string;
}

declare global {
  // Removed agPsd as it is no longer used
  // aistudio is already declared globally with type AIStudio
}