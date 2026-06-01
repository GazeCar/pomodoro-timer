'use client';

import React from 'react';
import { TimerMode, TimerState } from '@/types';

interface TimerProps {
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
  remainingSeconds: number;
  totalDuration: number;
  state: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export const Timer: React.FC<TimerProps> = ({
  mode,
  setMode,
  remainingSeconds,
  totalDuration,
  state,
  onStart,
  onPause,
  onReset,
  onSkip,
}) => {
  const radius = 95;
  const circumference = radius * 2 * Math.PI;
  const progressPercent = totalDuration > 0 ? (remainingSeconds / totalDuration) * 100 : 100;
  const strokeDashoffset = circumference - (progressPercent / 100 * circumference);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getModeLabel = (m: TimerMode) => {
    switch (m) {
      case 'work':
        return '作業中';
      case 'short':
        return '短い休憩';
      case 'long':
        return '長い休憩';
    }
  };

  return (
    <section className="timer-section glass-panel flex flex-col items-center justify-between text-center p-8 rounded-[24px] min-h-[480px]">
      {/* モード切替タブ */}
      <div className="mode-tabs flex bg-black/20 p-1.5 rounded-[30px] border border-glass-border gap-1 mb-6">
        <button
          onClick={() => setMode('work')}
          className={`tab-btn px-5 py-2 rounded-[20px] text-sm font-medium transition duration-300 cursor-pointer ${
            mode === 'work'
              ? 'bg-theme/15 text-theme font-semibold shadow-[inset_0_0_10px_rgba(var(--theme-color-rgb),0.1)]'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          作業
        </button>
        <button
          onClick={() => setMode('short')}
          className={`tab-btn px-5 py-2 rounded-[20px] text-sm font-medium transition duration-300 cursor-pointer ${
            mode === 'short'
              ? 'bg-theme/15 text-theme font-semibold shadow-[inset_0_0_10px_rgba(var(--theme-color-rgb),0.1)]'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          短い休憩
        </button>
        <button
          onClick={() => setMode('long')}
          className={`tab-btn px-5 py-2 rounded-[20px] text-sm font-medium transition duration-300 cursor-pointer ${
            mode === 'long'
              ? 'bg-theme/15 text-theme font-semibold shadow-[inset_0_0_10px_rgba(var(--theme-color-rgb),0.1)]'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          長い休憩
        </button>
      </div>

      {/* 円形タイマー */}
      <div className="timer-display-container relative w-[220px] height-[220px] flex items-center justify-center my-4 aspect-square">
        <svg className="progress-ring absolute top-0 left-0 w-full h-full -rotate-90" viewBox="0 0 220 220">
          {/* 背景サークル */}
          <circle className="progress-ring__background fill-transparent stroke-white/[0.03] stroke-[7]" cx="110" cy="110" r={radius} />
          {/* 進捗サークル */}
          <circle
            className="progress-ring__circle fill-transparent stroke-theme stroke-[8] stroke-linecap-round filter drop-shadow-[0_0_6px_rgba(var(--theme-color-rgb),0.6)]"
            cx="110"
            cy="110"
            r={radius}
            style={{
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset: strokeDashoffset,
            }}
          />
        </svg>
        <div className="timer-text-container flex flex-col items-center z-10 select-none">
          <span className="font-outfit text-[48px] font-extrabold tracking-tight text-white leading-none">
            {formatTime(remainingSeconds)}
          </span>
          <span className="mode-label text-[13px] font-semibold tracking-[2px] uppercase text-theme mt-2 transition duration-300">
            {getModeLabel(mode)}
          </span>
        </div>
      </div>

      {/* 操作コントロール */}
      <div className="timer-controls flex items-center gap-5 mt-4">
        <button
          onClick={onReset}
          className="control-btn secondary w-12 h-12 rounded-full border border-glass-border bg-white/[0.03] text-text-secondary hover:bg-white/[0.08] hover:text-white hover:border-glass-border-focus flex items-center justify-center transition duration-300 cursor-pointer"
          title="リセット"
        >
          <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        
        <button
          onClick={state === 'running' ? onPause : onStart}
          className="control-btn primary w-[72px] h-[72px] bg-theme text-bg-color rounded-full shadow-[0_4px_20px_rgba(var(--theme-color-rgb),0.4)] hover:scale-108 hover:shadow-[0_6px_24px_rgba(var(--theme-color-rgb),0.6)] active:scale-96 flex items-center justify-center transition duration-300 cursor-pointer"
          title={state === 'running' ? '一時停止' : '開始'}
        >
          {state === 'running' ? (
            <svg className="w-7 h-7 stroke-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg className="w-7 h-7 fill-current translate-x-[2px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        <button
          onClick={onSkip}
          className="control-btn secondary w-12 h-12 rounded-full border border-glass-border bg-white/[0.03] text-text-secondary hover:bg-white/[0.08] hover:text-white hover:border-glass-border-focus flex items-center justify-center transition duration-300 cursor-pointer"
          title="スキップ"
        >
          <svg className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      </div>
    </section>
  );
};
