'use client';

import React, { useState, useEffect } from 'react';
import { Settings } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
  onResetStats: () => void;
  onPlayTestSound: (volume: number) => void;
  onGenerateTestData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetStats,
  onPlayTestSound,
  onGenerateTestData,
}) => {
  const [workVal, setWorkVal] = useState(settings.workDuration);
  const [shortVal, setShortVal] = useState(settings.shortDuration);
  const [longVal, setLongVal] = useState(settings.longDuration);
  const [longBreakInterval, setLongBreakInterval] = useState(settings.longBreakInterval || 4);
  const [autoStartWork, setAutoStartWork] = useState(settings.autoStartWork || false);
  const [autoStartBreak, setAutoStartBreak] = useState(settings.autoStartBreak || false);
  const [muteNotification, setMuteNotification] = useState(settings.muteNotification || false);

  // モーダルが開かれた時にローカル状態を最新に同期
  useEffect(() => {
    if (isOpen) {
      setWorkVal(settings.workDuration);
      setShortVal(settings.shortDuration);
      setLongVal(settings.longDuration);
      setLongBreakInterval(settings.longBreakInterval || 4);
      setAutoStartWork(settings.autoStartWork || false);
      setAutoStartBreak(settings.autoStartBreak || false);
      setMuteNotification(settings.muteNotification || false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      workDuration: Math.max(1, workVal),
      shortDuration: Math.max(1, shortVal),
      longDuration: Math.max(1, longVal),
      volume: muteNotification ? 0 : 100,
      longBreakInterval: Math.max(1, longBreakInterval),
      autoStartWork,
      autoStartBreak,
      muteNotification,
    });
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="modal-overlay fixed top-0 left-0 w-full h-full bg-[#04050c]/70 backdrop-blur-[12px] z-[100] flex items-center justify-center transition duration-300"
    >
      <div className="modal-content glass-panel animate-modal w-full max-w-[480px] rounded-[28px] overflow-hidden p-8 border border-glass-border">
        {/* ヘッダー */}
        <div className="modal-header flex justify-between items-center mb-6 border-b border-glass-border pb-4">
          <h3 className="font-outfit text-xl font-semibold text-white">タイマー設定</h3>
          <button
            onClick={onClose}
            className="icon-btn small w-8 h-8 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition duration-300 cursor-pointer"
            aria-label="設定を閉じる"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        {/* ボディ */}
        <div className="modal-body flex flex-col gap-6">
          {/* 時間設定 */}
          <div className="settings-group flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">時間設定（分）</h4>
            <div className="time-inputs-grid grid grid-cols-3 gap-3">
              <div className="input-field flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary" htmlFor="input-work">作業</label>
                <input
                  type="number"
                  id="input-work"
                  min="1"
                  max="60"
                  value={workVal}
                  onChange={(e) => setWorkVal(parseInt(e.target.value) || 0)}
                  className="bg-black/25 border border-glass-border rounded-xl p-2.5 text-white text-sm font-semibold text-center outline-none transition duration-300 focus:border-theme"
                />
              </div>
              <div className="input-field flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary" htmlFor="input-short">短い休憩</label>
                <input
                  type="number"
                  id="input-short"
                  min="1"
                  max="30"
                  value={shortVal}
                  onChange={(e) => setShortVal(parseInt(e.target.value) || 0)}
                  className="bg-black/25 border border-glass-border rounded-xl p-2.5 text-white text-sm font-semibold text-center outline-none transition duration-300 focus:border-theme"
                />
              </div>
              <div className="input-field flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary" htmlFor="input-long">長い休憩</label>
                <input
                  type="number"
                  id="input-long"
                  min="1"
                  max="60"
                  value={longVal}
                  onChange={(e) => setLongVal(parseInt(e.target.value) || 0)}
                  className="bg-black/25 border border-glass-border rounded-xl p-2.5 text-white text-sm font-semibold text-center outline-none transition duration-300 focus:border-theme"
                />
              </div>
            </div>
          </div>

          {/* 頻度設定 */}
          <div className="settings-group flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white tracking-wide" htmlFor="input-interval">
              長時間休憩の頻度（セッション数）
            </label>
            <input
              type="number"
              id="input-interval"
              min="1"
              max="12"
              value={longBreakInterval}
              onChange={(e) => setLongBreakInterval(parseInt(e.target.value) || 4)}
              className="bg-black/25 border border-glass-border rounded-xl p-2.5 text-white text-sm font-semibold outline-none transition duration-300 focus:border-theme max-w-[120px]"
            />
          </div>

          {/* 動作オプション */}
          <div className="settings-group flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">動作オプション</h4>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoStartWork}
                  onChange={(e) => setAutoStartWork(e.target.checked)}
                  className="appearance-none w-4 h-4 border border-[#64748b] rounded-[4px] outline-none cursor-pointer flex items-center justify-center transition duration-300 checked:bg-theme checked:border-theme checked:after:content-[''] checked:after:w-2 checked:after:h-1 checked:after:border-l-[1.5px] checked:after:border-b-[1.5px] checked:after:border-bg-color checked:after:-rotate-45 checked:after:translate-x-[0.2px] checked:after:-translate-y-[0.2px]"
                />
                次の作業を自動スタート
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoStartBreak}
                  onChange={(e) => setAutoStartBreak(e.target.checked)}
                  className="appearance-none w-4 h-4 border border-[#64748b] rounded-[4px] outline-none cursor-pointer flex items-center justify-center transition duration-300 checked:bg-theme checked:border-theme checked:after:content-[''] checked:after:w-2 checked:after:h-1 checked:after:border-l-[1.5px] checked:after:border-b-[1.5px] checked:after:border-bg-color checked:after:-rotate-45 checked:after:translate-x-[0.2px] checked:after:-translate-y-[0.2px]"
                />
                次の休憩を自動スタート
              </label>
              <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={muteNotification}
                  onChange={(e) => setMuteNotification(e.target.checked)}
                  className="appearance-none w-4 h-4 border border-[#64748b] rounded-[4px] outline-none cursor-pointer flex items-center justify-center transition duration-300 checked:bg-theme checked:border-theme checked:after:content-[''] checked:after:w-2 checked:after:h-1 checked:after:border-l-[1.5px] checked:after:border-b-[1.5px] checked:after:border-bg-color checked:after:-rotate-45 checked:after:translate-x-[0.2px] checked:after:-translate-y-[0.2px]"
                />
                通知音をミュート
              </label>
            </div>
          </div>

          {/* テスト再生 */}
          <div className="settings-group flex flex-col gap-3">
            <button
              onClick={() => onPlayTestSound(muteNotification ? 0 : 100)}
              className="btn secondary w-full bg-white/[0.03] border border-glass-border text-text-secondary hover:bg-white/[0.07] hover:text-white hover:border-glass-border-focus px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition duration-300 cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              通知音をテスト再生
            </button>
          </div>

          {/* データ管理 */}
          <div className="settings-group flex flex-col gap-3">
            <button
              onClick={onResetStats}
              className="btn danger w-full bg-danger-color/10 border border-danger-color/20 text-danger-color hover:bg-danger-color hover:text-bg-color hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition duration-300 cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              統計データをリセット
            </button>

            {onGenerateTestData && (
              <button
                onClick={onGenerateTestData}
                className="btn secondary w-full bg-theme/10 border border-theme/20 text-theme hover:bg-theme hover:text-bg-color px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition duration-300 cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                ダミー統計データを生成 (7日分)
              </button>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="modal-footer mt-7 flex justify-end border-t border-glass-border pt-4">
          <button
            onClick={handleSave}
            className="btn primary bg-theme text-bg-color shadow-[0_4px_12px_rgba(var(--theme-color-rgb),0.2)] hover:shadow-[0_6px_16px_rgba(var(--theme-color-rgb),0.35)] hover:-translate-y-0.5 px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition duration-300 cursor-pointer"
          >
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
