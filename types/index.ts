export type TimerState = 'stopped' | 'running' | 'paused';
export type TimerMode = 'work' | 'short' | 'long';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Settings {
  workDuration: number;
  shortDuration: number;
  longDuration: number;
  volume: number;
}

export interface Stats {
  sessionsCompleted: number;
  totalFocusTime: number;
  completedTasksCount: number;
}

export interface ModeTheme {
  color: string;
  rgb: string;
  label: string;
}
