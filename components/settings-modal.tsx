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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetStats,
  onPlayTestSound,
}) => {
  const [workVal, setWorkVal] = useState(settings.workDuration);
  const [shortVal, setShortVal] = useState(settings.shortDuration);
  const [longVal, setLongVal] = useState(settings.longDuration);
  const [volumeVal, setVolumeVal] = useState(settings.volume);

  // モーダルが開かれた時にローカル状態を最新に同期
  useEffect(() => {
    if (isOpen) {
      setWorkVal(settings.workDuration);
      setShortVal(settings.shortDuration);
      setLongVal(settings.longDuration);
      setVolumeVal(settings.volume);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      workDuration: Math.max(1, workVal),
      shortDuration: Math.max(1, shortVal),
      longDuration: Math.max(1, longVal),
      volume: volumeVal,
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
            <h4 className="text-sm font-semibold text-white tracking-wide">セッション時間（分）</h4>
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

          {/* 通知設定 */}
          <div className="settings-group flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">通知設定</h4>
            <div className="sound-control flex flex-col gap-2">
              <label className="text-[13px] text-text-secondary" htmlFor="input-volume">通知音量</label>
              <div className="volume-slider-container flex items-center gap-3">
                <input
                  type="range"
                  id="input-volume"
                  min="0"
                  max="100"
                  value={volumeVal}
                  onChange={(e) => setVolumeVal(parseInt(e.target.value))}
                  className="flex-1 accent-theme bg-white/10 rounded-lg h-1.5 outline-none cursor-pointer"
                />
                <span id="volume-value" className="text-[13px] font-medium text-white min-w-9 text-right">
                  {volumeVal}%
                </span>
              </div>
            </div>
            <button
              onClick={() => onPlayTestSound(volumeVal)}
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
            <h4 className="text-sm font-semibold text-white tracking-wide">データ管理</h4>
            <button
              onClick={onResetStats}
              className="btn danger w-full bg-danger-color/10 border border-danger-color/20 text-danger-color hover:bg-danger-color hover:text-bg-color hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center transition duration-300 cursor-pointer"
            >
              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              統計データをリセット
            </button>
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
