'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Timer } from '@/components/timer';
import { TaskList } from '@/components/task-list';
import { Stats } from '@/components/stats';
import { SettingsModal } from '@/components/settings-modal';
import { Task, TimerMode, TimerState, Settings, Stats as StatsType } from '@/types';

// デフォルト設定値
const DEFAULT_SETTINGS: Settings = {
  workDuration: 25,
  shortDuration: 5,
  longDuration: 15,
  volume: 50,
};

const DEFAULT_STATS: StatsType = {
  sessionsCompleted: 0,
  totalFocusTime: 0,
  completedTasksCount: 0,
};

export default function Home() {
  // --- 状態管理 ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timerState, setTimerState] = useState<TimerState>('stopped');
  const [remainingSeconds, setRemainingSeconds] = useState(1500); // 25分
  const [totalDuration, setTotalDuration] = useState(1500);
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsType>(DEFAULT_STATS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- クライアントサイドでのローカルストレージからの復元 ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('focusflow_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    const savedTasks = localStorage.getItem('focusflow_tasks');
    if (savedTasks) setTasks(JSON.parse(savedTasks));

    const savedActiveTaskId = localStorage.getItem('focusflow_active_task_id');
    if (savedActiveTaskId) setActiveTaskId(savedActiveTaskId);

    const savedStats = localStorage.getItem('focusflow_stats');
    if (savedStats) setStats(JSON.parse(savedStats));

    setIsLoaded(true);
  }, []);

  // --- テーマカラーの動的切り替え効果 ---
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'work') {
      root.style.setProperty('--theme-color', 'var(--color-work)');
      root.style.setProperty('--theme-color-rgb', 'var(--color-work-rgb)');
    } else if (mode === 'short') {
      root.style.setProperty('--theme-color', 'var(--color-short)');
      root.style.setProperty('--theme-color-rgb', 'var(--color-short-rgb)');
    } else if (mode === 'long') {
      root.style.setProperty('--theme-color', 'var(--color-long)');
      root.style.setProperty('--theme-color-rgb', 'var(--color-long-rgb)');
    }
  }, [mode]);

  // --- 時間の更新とタイマーの初期設定 ---
  useEffect(() => {
    if (timerState === 'stopped') {
      let durationMins = settings.workDuration;
      if (mode === 'short') durationMins = settings.shortDuration;
      if (mode === 'long') durationMins = settings.longDuration;
      
      setTotalDuration(durationMins * 60);
      setRemainingSeconds(durationMins * 60);
    }
  }, [mode, settings, timerState]);

  // --- タブタイトル時間表示の更新効果 ---
  useEffect(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.title = `${timeStr} - FocusFlow`;
  }, [remainingSeconds]);

  // --- タイマー動作制御 (Interval) ---
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleTimerExpiry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState]);

  // --- 音声シンセサイザー (Web Audio API) ---
  const playNotificationSound = (volume: number) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    try {
      const ctx = new AudioContext();
      const gainVolume = volume / 100;
      if (gainVolume === 0) return;

      const now = ctx.currentTime;

      // 1音目: 高いチャイム音 (B5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(gainVolume * 0.3, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // 2音目: 心地よい和音 (G5 - 少し遅らせて発音)
      const delay = 0.15;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + delay);
      gain2.gain.setValueAtTime(0, now + delay);
      gain2.gain.linearRampToValueAtTime(gainVolume * 0.3, now + delay + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.9);
    } catch (e) {
      console.error('オーディオ再生エラー:', e);
    }
  };

  // --- タイマー終了時の処理 ---
  const handleTimerExpiry = () => {
    setTimerState('stopped');
    playNotificationSound(settings.volume);

    let completedSessions = stats.sessionsCompleted;
    let focusTime = stats.totalFocusTime;

    // 統計情報の更新 (作業完了時のみ)
    if (mode === 'work') {
      completedSessions += 1;
      focusTime += settings.workDuration;
      const updatedStats = {
        ...stats,
        sessionsCompleted: completedSessions,
        totalFocusTime: focusTime,
      };
      setStats(updatedStats);
      localStorage.setItem('focusflow_stats', JSON.stringify(updatedStats));
    }

    // 次のモード決定
    let nextMode: TimerMode = 'work';
    if (mode === 'work') {
      if (completedSessions > 0 && completedSessions % 4 === 0) {
        nextMode = 'long';
      } else {
        nextMode = 'short';
      }
    } else {
      nextMode = 'work';
    }

    setTimeout(() => {
      alert(`${mode === 'work' ? '作業セッション' : '休憩'}が終了しました！`);
      setMode(nextMode);
    }, 100);
  };

  // --- 各種操作ハンドラー ---
  const handleStart = () => {
    setTimerState('running');
  };

  const handlePause = () => {
    setTimerState('paused');
  };

  const handleReset = () => {
    setTimerState('stopped');
    let durationMins = settings.workDuration;
    if (mode === 'short') durationMins = settings.shortDuration;
    if (mode === 'long') durationMins = settings.longDuration;
    setRemainingSeconds(durationMins * 60);
  };

  const handleSkip = () => {
    if (confirm('現在のセッションをスキップして、次のセッションに進みますか？')) {
      handleTimerExpiry();
    }
  };

  // タスク追加
  const handleAddTask = (text: string) => {
    const newTasks = [
      ...tasks,
      {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
        text,
        completed: false,
      },
    ];
    setTasks(newTasks);
    localStorage.setItem('focusflow_tasks', JSON.stringify(newTasks));

    // 最初に追加したタスクなら自動アクティブ
    if (newTasks.length === 1) {
      setActiveTaskId(newTasks[0].id);
      localStorage.setItem('focusflow_active_task_id', newTasks[0].id);
    }
  };

  // タスク削除
  const handleDeleteTask = (id: string) => {
    const newTasks = tasks.filter((t) => t.id !== id);
    setTasks(newTasks);
    localStorage.setItem('focusflow_tasks', JSON.stringify(newTasks));

    if (activeTaskId === id) {
      setActiveTaskId(null);
      localStorage.setItem('focusflow_active_task_id', '');
    }
  };

  // タスク完了切り替え
  const handleToggleTask = (id: string) => {
    let completedCount = stats.completedTasksCount;

    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        if (nextCompleted) {
          completedCount += 1;
        } else {
          completedCount = Math.max(0, completedCount - 1);
        }
        return { ...t, completed: nextCompleted };
      }
      return t;
    });

    setTasks(newTasks);
    localStorage.setItem('focusflow_tasks', JSON.stringify(newTasks));

    const updatedStats = { ...stats, completedTasksCount: completedCount };
    setStats(updatedStats);
    localStorage.setItem('focusflow_stats', JSON.stringify(updatedStats));

    // もし完了したタスクが現在アクティブだった場合、アクティブ解除
    const completedTask = newTasks.find((t) => t.id === id);
    if (completedTask?.completed && activeTaskId === id) {
      setActiveTaskId(null);
      localStorage.setItem('focusflow_active_task_id', '');
    }
  };

  // アクティブタスク選択
  const handleSelectTask = (id: string) => {
    const nextId = activeTaskId === id ? null : id;
    setActiveTaskId(nextId);
    localStorage.setItem('focusflow_active_task_id', nextId || '');
  };

  // 設定の保存
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem('focusflow_settings', JSON.stringify(newSettings));
  };

  // 統計リセット
  const handleResetStats = () => {
    if (confirm('すべての今日のフォーカス統計データをリセットしますか？この操作は取り消せません。')) {
      setStats(DEFAULT_STATS);
      localStorage.setItem('focusflow_stats', JSON.stringify(DEFAULT_STATS));
      alert('統計データをリセットしました。');
    }
  };

  // ハイドレーションエラーを防止するため、クライアントローディングが完了するまでダミー表示
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[#94a3b8]">
        読み込み中...
      </div>
    );
  }

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeTaskName = activeTask && !activeTask.completed ? activeTask.text : null;

  return (
    <div className="app-container w-full max-w-[1100px] p-6 flex flex-col gap-6 flex-1 mx-auto">
      {/* 背景のネオンオーブ */}
      <div className="orb-container absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="orb orb-1 absolute w-[450px] h-[450px] rounded-full filter blur-[120px] opacity-25 top-[-10%] left-[-10%] bg-[radial-gradient(circle,rgba(var(--color-work-rgb),0.6)_0%,rgba(0,0,0,0)_70%)] orb-float-1" />
        <div className="orb orb-2 absolute w-[550px] h-[550px] rounded-full filter blur-[120px] opacity-25 bottom-[-15%] right-[-10%] bg-[radial-gradient(circle,rgba(var(--color-short-rgb),0.6)_0%,rgba(0,0,0,0)_70%)] orb-float-2" />
        <div className="orb orb-3 absolute w-[350px] h-[350px] rounded-full filter blur-[120px] opacity-15 top-[40%] left-[50%] -translate-x-[50%] -translate-y-[50%] bg-[radial-gradient(circle,rgba(var(--color-long-rgb),0.4)_0%,rgba(0,0,0,0)_70%)] orb-float-3" />
      </div>

      {/* ヘッダー */}
      <header className="app-header flex justify-between items-center w-full px-3 py-2">
        <div className="logo flex items-center gap-3">
          <svg className="logo-icon w-7 h-7 text-theme drop-shadow-[0_0_8px_rgba(var(--theme-color-rgb),0.5)] transition duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <h1 className="font-outfit text-2xl font-bold tracking-tight text-white select-none">
            FocusFlow
          </h1>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="icon-btn w-11 h-11 bg-white/[0.03] border border-glass-border hover:bg-white/[0.08] hover:text-white hover:border-glass-border-focus hover:rotate-15 flex items-center justify-center rounded-xl cursor-pointer text-text-secondary transition duration-300"
          title="設定"
        >
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="app-main grid grid-cols-[1.2fr_1fr] max-[900px]:grid-cols-1 gap-6 w-full">
        {/* タイマー表示コラム */}
        <Timer
          mode={mode}
          setMode={(m) => {
            setMode(m);
            setTimerState('stopped');
          }}
          remainingSeconds={remainingSeconds}
          totalDuration={totalDuration}
          state={timerState}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onSkip={handleSkip}
          activeTaskName={activeTaskName}
        />

        {/* タスク・統計コラム */}
        <div className="sidebar-section flex flex-col gap-6">
          <TaskList
            tasks={tasks}
            activeTaskId={activeTaskId}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onToggleTask={handleToggleTask}
            onSelectTask={handleSelectTask}
          />
          <Stats
            sessionsCompleted={stats.sessionsCompleted}
            totalFocusTime={stats.totalFocusTime}
            completedTasksCount={stats.completedTasksCount}
          />
        </div>
      </main>

      {/* フッター */}
      <footer className="app-footer text-center py-6 text-xs text-[#64748b] w-full mt-auto">
        <p>FocusFlow &copy; 2026 - Antigravity 開発サンプル (Next.js)</p>
      </footer>

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onResetStats={handleResetStats}
        onPlayTestSound={playNotificationSound}
      />
    </div>
  );
}
