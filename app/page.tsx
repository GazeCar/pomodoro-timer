'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Timer } from '@/components/timer';
import { TaskList } from '@/components/task-list';
import { Stats } from '@/components/stats';
import { SettingsModal } from '@/components/settings-modal';
import { AuthModal } from '@/components/auth-modal';
import { Task, TimerMode, TimerState, Settings, Stats as StatsType } from '@/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

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
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timerState, setTimerState] = useState<TimerState>('stopped');
  const [remainingSeconds, setRemainingSeconds] = useState(1500); // 25分
  const [totalDuration, setTotalDuration] = useState(1500);
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsType>(DEFAULT_STATS);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- WebSocket 同期用 Refs (最新のステート値をリスナー内で参照するため) ---
  const timerStateRef = useRef(timerState);
  const modeRef = useRef(mode);
  const remainingSecondsRef = useRef(remainingSeconds);

  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { remainingSecondsRef.current = remainingSeconds; }, [remainingSeconds]);

  // --- 1. Supabase 認証状態の監視 ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- 2. 初期データロード ＆ 同期 ---
  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = localStorage.getItem('focusflow_settings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      if (user) {
        await syncDataFromSupabase(user.id);
        await syncTimerFromSupabase(user.id);
      } else {
        const savedTasks = localStorage.getItem('focusflow_tasks');
        if (savedTasks) setTasks(JSON.parse(savedTasks));

        const savedActiveTaskId = localStorage.getItem('focusflow_active_task_id');
        if (savedActiveTaskId) setActiveTaskId(savedActiveTaskId);

        const savedStats = localStorage.getItem('focusflow_stats');
        if (savedStats) setStats(JSON.parse(savedStats));
      }
      setIsLoaded(true);
    };

    loadInitialData();
  }, [user]);

  // --- 3. Supabase からのタイマー状態のロード ---
  const syncTimerFromSupabase = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_timers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // 存在しない場合(PGRST116)以外はエラー

      if (data) {
        const remoteState = data.state as TimerState;
        const remoteMode = data.mode as TimerMode;

        let remoteRemaining = data.remaining_seconds;
        if (remoteState === 'running' && data.target_end_at) {
          const msDiff = new Date(data.target_end_at).getTime() - Date.now();
          remoteRemaining = Math.max(0, Math.floor(msDiff / 1000));
        }

        setMode(remoteMode);
        setTimerState(remoteState === 'running' && remoteRemaining <= 0 ? 'stopped' : remoteState);
        setRemainingSeconds(remoteRemaining);
      }
    } catch (err) {
      console.error('タイマーロードエラー:', err);
    }
  };

  // --- 4. Supabase Realtime によるタイマー状態のWebSocket同期 ---
  useEffect(() => {
    if (!user) return;

    const handleRemoteTimerSync = (dbTimer: any) => {
      const localState = timerStateRef.current;
      const localMode = modeRef.current;
      const localRemaining = remainingSecondsRef.current;

      const remoteState = dbTimer.state as TimerState;
      const remoteMode = dbTimer.mode as TimerMode;

      let remoteRemaining = dbTimer.remaining_seconds;
      if (remoteState === 'running' && dbTimer.target_end_at) {
        const msDiff = new Date(dbTimer.target_end_at).getTime() - Date.now();
        remoteRemaining = Math.max(0, Math.floor(msDiff / 1000));
      }

      // 自分自身の操作による差分でなければ同期する（モード相違、ステート相違、または時間差が3秒以上）
      const isStateSame = localState === remoteState;
      const isModeSame = localMode === remoteMode;
      const isTimeClose = Math.abs(localRemaining - remoteRemaining) <= 3;

      if (isStateSame && isModeSame && isTimeClose) {
        return; // 同期不要
      }

      // 同期実行
      setMode(remoteMode);
      setTimerState(remoteState === 'running' && remoteRemaining <= 0 ? 'stopped' : remoteState);
      setRemainingSeconds(remoteRemaining);
    };

    // チャンネル監視設定
    const channel = supabase
      .channel(`timer_sync_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_timers',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            handleRemoteTimerSync(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- 5. タイマー状態をDBに書き込む処理 ---
  const updateDbTimerState = async (newState: TimerState, newMode: TimerMode, newRemainingSeconds: number) => {
    if (!user) return;
    try {
      const targetEndAt = newState === 'running'
        ? new Date(Date.now() + newRemainingSeconds * 1000).toISOString()
        : null;

      await supabase.from('user_timers').upsert({
        user_id: user.id,
        state: newState,
        mode: newMode,
        remaining_seconds: newRemainingSeconds,
        target_end_at: targetEndAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('DBタイマー状態更新エラー:', err);
    }
  };

  // --- 6. タスク・統計データのSupabaseロード ---
  const syncDataFromSupabase = async (userId: string) => {
    try {
      const { data: dbTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });

      if (tasksError) throw tasksError;

      const { data: dbSessions, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*');

      if (sessionsError) throw sessionsError;

      const mappedTasks: Task[] = (dbTasks || []).map((t: any) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
      }));

      setTasks(mappedTasks);

      const completedSessionsCount = dbSessions?.length || 0;
      const totalFocusMins = dbSessions?.reduce((sum: number, s: any) => sum + s.duration, 0) || 0;
      const completedTasksCount = mappedTasks.filter(t => t.completed).length;

      setStats({
        sessionsCompleted: completedSessionsCount,
        totalFocusTime: totalFocusMins,
        completedTasksCount: completedTasksCount,
      });

      const savedActiveTaskId = localStorage.getItem('focusflow_active_task_id');
      if (savedActiveTaskId && mappedTasks.some(t => t.id === savedActiveTaskId && !t.completed)) {
        setActiveTaskId(savedActiveTaskId);
      } else {
        const firstActive = mappedTasks.find(t => !t.completed);
        setActiveTaskId(firstActive ? firstActive.id : null);
      }
    } catch (err) {
      console.error('Supabase同期エラー:', err);
    }
  };

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
            setTimeout(handleTimerExpiry, 0);
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

      // 2音目: 心地よい和音 (G5)
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
  const handleTimerExpiry = async () => {
    setTimerState('stopped');
    playNotificationSound(settings.volume);

    // 終了状態を即座にDBに保存
    await updateDbTimerState('stopped', mode, 0);

    // 統計情報の更新 (作業完了時のみ)
    if (mode === 'work') {
      if (user) {
        try {
          const { error } = await supabase.from('focus_sessions').insert({
            user_id: user.id,
            duration: settings.workDuration,
            mode: 'work',
          });
          if (error) throw error;
          await syncDataFromSupabase(user.id);
        } catch (err) {
          console.error('セッション書き込みエラー:', err);
        }
      } else {
        const nextSessions = stats.sessionsCompleted + 1;
        const nextTime = stats.totalFocusTime + settings.workDuration;
        const updatedStats = {
          ...stats,
          sessionsCompleted: nextSessions,
          totalFocusTime: nextTime,
        };
        setStats(updatedStats);
        localStorage.setItem('focusflow_stats', JSON.stringify(updatedStats));
      }
    }

    // 次のモード決定
    let nextMode: TimerMode = 'work';
    if (mode === 'work') {
      const currentCompleted = user 
        ? stats.sessionsCompleted + 1
        : stats.sessionsCompleted;
      if (currentCompleted > 0 && currentCompleted % 4 === 0) {
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
  const handleStart = async () => {
    setTimerState('running');
    await updateDbTimerState('running', mode, remainingSeconds);
  };

  const handlePause = async () => {
    setTimerState('paused');
    await updateDbTimerState('paused', mode, remainingSeconds);
  };

  const handleReset = async () => {
    setTimerState('stopped');
    let durationMins = settings.workDuration;
    if (mode === 'short') durationMins = settings.shortDuration;
    if (mode === 'long') durationMins = settings.longDuration;
    const durationSecs = durationMins * 60;
    
    setRemainingSeconds(durationSecs);
    await updateDbTimerState('stopped', mode, durationSecs);
  };

  const handleSkip = () => {
    if (confirm('現在のセッションをスキップして、次のセッションに進みますか？')) {
      handleTimerExpiry();
    }
  };

  // タスク追加
  const handleAddTask = async (text: string) => {
    if (user) {
      try {
        const { data, error } = await supabase.from('tasks').insert({
          user_id: user.id,
          text,
          completed: false,
        }).select();

        if (error) throw error;
        if (data && data.length > 0) {
          const newTask: Task = { id: data[0].id, text: data[0].text, completed: data[0].completed };
          setTasks((prev) => [...prev, newTask]);
          
          if (tasks.length === 0) {
            setActiveTaskId(newTask.id);
            localStorage.setItem('focusflow_active_task_id', newTask.id);
          }
        }
      } catch (err) {
        console.error('タスク追加エラー:', err);
      }
    } else {
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

      if (newTasks.length === 1) {
        setActiveTaskId(newTasks[0].id);
        localStorage.setItem('focusflow_active_task_id', newTasks[0].id);
      }
    }
  };

  // タスク削除
  const handleDeleteTask = async (id: string) => {
    if (user) {
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        console.error('タスク削除エラー:', err);
      }
    } else {
      const newTasks = tasks.filter((t) => t.id !== id);
      setTasks(newTasks);
      localStorage.setItem('focusflow_tasks', JSON.stringify(newTasks));
    }

    if (activeTaskId === id) {
      setActiveTaskId(null);
      localStorage.setItem('focusflow_active_task_id', '');
    }
  };

  // タスク完了切り替え
  const handleToggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const nextCompleted = !task.completed;

    if (user) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ completed: nextCompleted })
          .eq('id', id);
        if (error) throw error;
        
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: nextCompleted } : t));
        setStats((prev) => ({
          ...prev,
          completedTasksCount: prev.completedTasksCount + (nextCompleted ? 1 : -1),
        }));
      } catch (err) {
        console.error('タスク更新エラー:', err);
      }
    } else {
      let completedCount = stats.completedTasksCount;
      const newTasks = tasks.map((t) => {
        if (t.id === id) {
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
    }

    if (nextCompleted && activeTaskId === id) {
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
  const handleResetStats = async () => {
    if (confirm('すべての今日のフォーカス統計データをリセットしますか？この操作は取り消せません。')) {
      if (user) {
        try {
          const { error } = await supabase.from('focus_sessions').delete().eq('user_id', user.id);
          if (error) throw error;
          await syncDataFromSupabase(user.id);
          alert('統計データをリセットしました。');
        } catch (err) {
          console.error('統計データリセットエラー:', err);
        }
      } else {
        setStats(DEFAULT_STATS);
        localStorage.setItem('focusflow_stats', JSON.stringify(DEFAULT_STATS));
        alert('統計データをリセットしました。');
      }
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('ログアウトエラー:', error);
      setTasks([]);
      setActiveTaskId(null);
      setStats(DEFAULT_STATS);
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
        
        {/* クラウド同期・認証コントロール */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-white/[0.03] border border-glass-border px-4 py-1.5 rounded-xl text-xs text-text-secondary select-none">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="truncate max-w-[120px]" title={user.email}>{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-theme hover:underline border-none bg-transparent cursor-pointer font-medium"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-theme/15 hover:bg-theme/25 text-theme text-xs font-semibold px-4 py-2.5 rounded-xl border border-theme/30 transition duration-300 flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              クラウド同期
            </button>
          )}

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
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="app-main grid grid-cols-[1.2fr_1fr] max-[900px]:grid-cols-1 gap-6 w-full">
        {/* タイマー表示コラム */}
        <Timer
          mode={mode}
          setMode={async (m) => {
            setMode(m);
            setTimerState('stopped');
            // モード切替時にDB側のタイマーも停止状態で保存
            let durationMins = settings.workDuration;
            if (m === 'short') durationMins = settings.shortDuration;
            if (m === 'long') durationMins = settings.longDuration;
            await updateDbTimerState('stopped', m, durationMins * 60);
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
        <p>FocusFlow &copy; 2026 - Antigravity 開発サンプル (Next.js + Supabase)</p>
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

      {/* 認証モーダル */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={async () => {
          const { data: { user: loggedInUser } } = await supabase.auth.getUser();
          if (loggedInUser) {
            setIsAuthOpen(false);
          }
        }}
      />
    </div>
  );
}
