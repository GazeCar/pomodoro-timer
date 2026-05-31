'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage('確認メールを送信しました！メールボックスをご確認ください。');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || '認証中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
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
      <div className="modal-content glass-panel animate-modal w-full max-w-[400px] rounded-[28px] overflow-hidden p-8 border border-glass-border">
        {/* ヘッダー */}
        <div className="modal-header flex justify-between items-center mb-6 border-b border-glass-border pb-4">
          <h3 className="font-outfit text-xl font-semibold text-white">
            {isSignUp ? 'アカウント作成' : 'ログイン'}
          </h3>
          <button
            onClick={onClose}
            className="icon-btn small w-8 h-8 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition duration-300 cursor-pointer"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-2 rounded-xl">
              {message}
            </div>
          )}

          <div className="input-field flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary" htmlFor="auth-email">メールアドレス</label>
            <input
              type="email"
              id="auth-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="bg-black/25 border border-glass-border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition duration-300 focus:border-theme"
            />
          </div>

          <div className="input-field flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary" htmlFor="auth-password">パスワード</label>
            <input
              type="password"
              id="auth-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="bg-black/25 border border-glass-border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition duration-300 focus:border-theme"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn primary w-full bg-theme text-bg-color font-semibold py-3 rounded-xl shadow-[0_4px_12px_rgba(var(--theme-color-rgb),0.2)] hover:shadow-[0_6px_16px_rgba(var(--theme-color-rgb),0.35)] hover:-translate-y-0.5 flex items-center justify-center transition duration-300 cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {loading ? '処理中...' : isSignUp ? '登録する' : 'ログイン'}
          </button>
        </form>

        {/* 切り替え */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-theme hover:underline bg-transparent border-none cursor-pointer"
          >
            {isSignUp ? 'すでにアカウントをお持ちですか？ ログイン' : '新しくアカウントを作成する'}
          </button>
        </div>
      </div>
    </div>
  );
};
