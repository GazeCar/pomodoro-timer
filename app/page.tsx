'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Timer } from '@/components/timer';
import { Stats } from '@/components/stats';
import { SettingsModal } from '@/components/settings-modal';
import { AuthModal } from '@/components/auth-modal';
import { TimerMode, TimerState, Settings, Stats as StatsType } from '@/types';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// デフォルト設定値
const DEFAULT_SETTINGS: Settings = {
  workDuration: 25,
  shortDuration: 5,
  longDuration: 15,
  volume: 100,
  longBreakInterval: 4,
  autoStartWork: false,
  autoStartBreak: false,
  muteNotification: false,
};

interface FocusSession {
  id: string;
  duration: number;
  mode: string;
  completedAt: string;
}

export default function Home() {
  // --- 状態管理 ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timerState, setTimerState] = useState<TimerState>('stopped');
  const [remainingSeconds, setRemainingSeconds] = useState(1500); // 25分
  const [totalDuration, setTotalDuration] = useState(1500);
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('sv-SE')); // YYYY-MM-DD
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- WebSocket 同期用 Refs (最新のステート値をリスナー内で参照するため) ---
  const timerStateRef = useRef(timerState);
  const modeRef = useRef(mode);
  const remainingSecondsRef = useRef(remainingSeconds);
  const settingsRef = useRef(settings);

  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { remainingSecondsRef.current = remainingSeconds; }, [remainingSeconds]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

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
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed
        });
      }

      if (user) {
        await syncDataFromSupabase(user.id);
        await syncTimerFromSupabase(user.id);
      } else {
        const savedSessions = localStorage.getItem('focusflow_sessions');
        if (savedSessions) {
          setFocusSessions(JSON.parse(savedSessions));
        }
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

      if (error && error.code !== 'PGRST116') throw error;

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

      const isStateSame = localState === remoteState;
      const isModeSame = localMode === remoteMode;
      const isTimeClose = Math.abs(localRemaining - remoteRemaining) <= 3;

      if (isStateSame && isModeSame && isTimeClose) {
        return; 
      }

      setMode(remoteMode);
      setTimerState(remoteState === 'running' && remoteRemaining <= 0 ? 'stopped' : remoteState);
      setRemainingSeconds(remoteRemaining);
    };

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

  // --- 6. 統計データのSupabaseロード ---
  const syncDataFromSupabase = async (userId: string) => {
    try {
      const { data: dbSessions, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*');

      if (sessionsError) throw sessionsError;

      const mappedSessions: FocusSession[] = (dbSessions || []).map((s: any) => ({
        id: s.id,
        duration: s.duration,
        mode: s.mode,
        completedAt: s.completed_at || s.completedAt,
      }));

      setFocusSessions(mappedSessions);
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
    document.title = `${timeStr} - Pomodoro Timer Δ`;
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
    if (settingsRef.current.muteNotification) return;

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

  // --- 統計データの集計算出 ---
  const getFilteredStats = () => {
    const filtered = focusSessions.filter((session) => {
      const sessionDateStr = new Date(session.completedAt).toLocaleDateString('sv-SE');
      return sessionDateStr === selectedDate;
    });

    const completedCount = filtered.length;
    const totalDurationMins = filtered.reduce((sum, s) => sum + s.duration, 0);

    return {
      sessionsCompleted: completedCount,
      totalFocusTime: totalDurationMins,
    };
  };

  // --- タイマー終了時の処理 ---
  const handleTimerExpiry = async () => {
    playNotificationSound(100);

    // 次のモード決定
    let nextMode: TimerMode = 'work';
    if (mode === 'work') {
      const interval = settingsRef.current.longBreakInterval || 4;
      // 今回のセッションを含めて次のモード決定
      const currentCompleted = getFilteredStats().sessionsCompleted + 1;
      if (currentCompleted > 0 && currentCompleted % interval === 0) {
        nextMode = 'long';
      } else {
        nextMode = 'short';
      }
    } else {
      nextMode = 'work';
    }

    const isNextWork = nextMode === 'work';
    const shouldAutoStart = isNextWork 
      ? settingsRef.current.autoStartWork 
      : settingsRef.current.autoStartBreak;

    const nextState = shouldAutoStart ? 'running' : 'stopped';

    let durationMins = settingsRef.current.workDuration;
    if (nextMode === 'short') durationMins = settingsRef.current.shortDuration;
    if (nextMode === 'long') durationMins = settingsRef.current.longDuration;
    const nextSeconds = durationMins * 60;

    setMode(nextMode);
    setTimerState(nextState);
    setRemainingSeconds(nextSeconds);

    await updateDbTimerState(nextState, nextMode, nextSeconds);

    // 統計情報の更新 (作業完了時のみ)
    if (mode === 'work') {
      if (user) {
        try {
          const { data, error } = await supabase.from('focus_sessions').insert({
            user_id: user.id,
            duration: settingsRef.current.workDuration,
            mode: 'work',
          }).select();

          if (error) throw error;
          if (data && data.length > 0) {
            const newSession = {
              id: data[0].id,
              duration: data[0].duration,
              mode: data[0].mode,
              completedAt: data[0].completed_at,
            };
            setFocusSessions((prev) => [...prev, newSession]);
          }
        } catch (err) {
          console.error('セッション書き込みエラー:', err);
        }
      } else {
        const newSession = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
          duration: settingsRef.current.workDuration,
          mode: 'work',
          completedAt: new Date().toISOString(),
        };
        const nextSessions = [...focusSessions, newSession];
        setFocusSessions(nextSessions);
        localStorage.setItem('focusflow_sessions', JSON.stringify(nextSessions));
      }
    }

    setTimeout(() => {
      alert(`${mode === 'work' ? '作業セッション' : '休憩'}が終了しました！`);
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
          setFocusSessions([]);
          alert('統計データをリセットしました。');
        } catch (err) {
          console.error('統計データリセットエラー:', err);
        }
      } else {
        setFocusSessions([]);
        localStorage.setItem('focusflow_sessions', JSON.stringify([]));
        alert('統計データをリセットしました。');
      }
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('ログアウトエラー:', error);
      setFocusSessions([]);
      setTimerState('stopped');
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

  const filteredStats = getFilteredStats();

  return (
    <div className="app-container w-full max-w-[1100px] px-4 sm:px-6 py-6 flex flex-col gap-6 flex-1 mx-auto overflow-hidden">
      {/* 背景のネオンオーブ */}
      <div className="orb-container absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="orb orb-1 absolute w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] rounded-full filter blur-[80px] sm:blur-[120px] opacity-25 top-[-10%] left-[-10%] bg-[radial-gradient(circle,rgba(var(--color-work-rgb),0.6)_0%,rgba(0,0,0,0)_70%)] orb-float-1" />
        <div className="orb orb-2 absolute w-[350px] h-[350px] sm:w-[550px] sm:h-[550px] rounded-full filter blur-[80px] sm:blur-[120px] opacity-25 bottom-[-15%] right-[-10%] bg-[radial-gradient(circle,rgba(var(--color-short-rgb),0.6)_0%,rgba(0,0,0,0)_70%)] orb-float-2" />
        <div className="orb orb-3 absolute w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] rounded-full filter blur-[80px] sm:blur-[120px] opacity-15 top-[40%] left-[50%] -translate-x-[50%] -translate-y-[50%] bg-[radial-gradient(circle,rgba(var(--color-long-rgb),0.4)_0%,rgba(0,0,0,0)_70%)] orb-float-3" />
      </div>

      {/* ヘッダー */}
      <header className="app-header flex justify-between items-center w-full px-1 sm:px-3 py-2 gap-2">
        <div className="logo flex items-center gap-2 sm:gap-3">
          <svg className="logo-icon w-6 h-6 sm:w-7 sm:h-7 text-theme drop-shadow-[0_0_8px_rgba(var(--theme-color-rgb),0.5)] transition duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <h1 className="font-outfit text-lg sm:text-2xl font-bold tracking-tight text-white select-none whitespace-nowrap">
            Pomodoro Timer Δ
          </h1>
        </div>
        
        {/* クラウド同期・認証コントロール */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-glass-border px-3 py-2 rounded-xl text-xs text-text-secondary select-none">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="クラウド同期中" />
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
              className="bg-theme/15 hover:bg-theme/25 text-theme text-xs font-semibold p-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-theme/30 transition duration-300 flex items-center gap-1.5 cursor-pointer"
              title="クラウド同期"
            >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span className="hidden sm:inline">クラウド同期</span>
            </button>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="icon-btn w-9 h-9 sm:w-11 sm:h-11 bg-white/[0.03] border border-glass-border hover:bg-white/[0.08] hover:text-white hover:border-glass-border-focus hover:rotate-15 flex items-center justify-center rounded-xl cursor-pointer text-text-secondary transition duration-300"
            title="設定"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        />

        {/* 統計コラム (タスク管理は削除されました) */}
        <div className="sidebar-section flex flex-col gap-6">
          <Stats
            sessionsCompleted={filteredStats.sessionsCompleted}
            totalFocusTime={filteredStats.totalFocusTime}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      </main>

      {/* フッター */}
      <footer className="app-footer text-center py-6 text-xs text-[#64748b] w-full mt-auto">
        <p>Pomodoro Timer Δ &copy; 2026 - Antigravity 開発サンプル</p>
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
