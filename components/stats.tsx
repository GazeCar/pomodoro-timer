'use client';

import React from 'react';

interface StatsProps {
  sessionsCompleted: number;
  totalFocusTime: number;
  completedTasksCount: number;
}

export const Stats: React.FC<StatsProps> = ({
  sessionsCompleted,
  totalFocusTime,
  completedTasksCount,
}) => {
  return (
    <section className="stats-section glass-panel p-8 rounded-[24px]">
      <h2 className="panel-title text-lg font-semibold font-outfit flex items-center gap-2.5 mb-5 text-white">
        <svg className="panel-title-icon w-5 h-5 text-theme transition duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        今日のフォーカス統計
      </h2>
      
      <div className="stats-grid grid grid-cols-3 gap-4 max-[480px]:grid-cols-1">
        {/* セッションカード */}
        <div className="stat-card bg-black/15 border border-glass-border p-4 rounded-2xl flex flex-col gap-3 items-start">
          <div className="stat-icon timer-theme w-9 h-9 rounded-xl bg-work/10 text-work flex items-center justify-center">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-info flex flex-col">
            <span id="stat-sessions" className="stat-value font-outfit text-xl font-bold text-white">
              {sessionsCompleted}
            </span>
            <span className="stat-label text-[11px] text-text-secondary mt-0.5">セッション完了</span>
          </div>
        </div>

        {/* 総時間カード */}
        <div className="stat-card bg-black/15 border border-glass-border p-4 rounded-2xl flex flex-col gap-3 items-start">
          <div className="stat-icon time-theme w-9 h-9 rounded-xl bg-short/10 text-short flex items-center justify-center">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="stat-info flex flex-col">
            <span id="stat-total-time" className="stat-value font-outfit text-xl font-bold text-white">
              {totalFocusTime}m
            </span>
            <span className="stat-label text-[11px] text-text-secondary mt-0.5">総集中時間</span>
          </div>
        </div>

        {/* 完了タスクカード */}
        <div className="stat-card bg-black/15 border border-glass-border p-4 rounded-2xl flex flex-col gap-3 items-start">
          <div className="stat-icon check-theme w-9 h-9 rounded-xl bg-long/10 text-long flex items-center justify-center">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="stat-info flex flex-col">
            <span id="stat-completed-tasks" className="stat-value font-outfit text-xl font-bold text-white">
              {completedTasksCount}
            </span>
            <span className="stat-label text-[11px] text-text-secondary mt-0.5">完了タスク</span>
          </div>
        </div>
      </div>
    </section>
  );
};
