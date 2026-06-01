export type TimerState = 'stopped' | 'running' | 'paused';
export type TimerMode = 'work' | 'short' | 'long';

export interface Settings {
  workDuration: number;
  shortDuration: number;
  longDuration: number;
  volume: number; // ミュート判定時に 0、解除時に 100 として扱います
  longBreakInterval: number; // 長時間休憩の頻度
  autoStartWork: boolean; // 次の作業を自動スタート
  autoStartBreak: boolean; // 次の休憩を自動スタート
  muteNotification: boolean; // 通知音をミュート
}

export interface Stats {
  sessionsCompleted: number;
  totalFocusTime: number;
  completedTasksCount: number; // 互換性のため残す、または将来のために残しますが今回は使いません
}

export interface ModeTheme {
  color: string;
  rgb: string;
  label: string;
}
