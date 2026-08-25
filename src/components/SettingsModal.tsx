'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, LogIn, Sun, Moon, Laptop } from 'lucide-react';
import { AppSettings } from '../types';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onTestRaindropSync: (token: string) => Promise<void>;
  isTestingSync: boolean;
  syncTestMessage: string | null;
  hasEnvToken?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onTestRaindropSync,
  isTestingSync,
  syncTestMessage,
  hasEnvToken: propHasEnvToken,
}) => {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [raindropToken, setRaindropToken] = useState(settings.raindropToken);
  const [mounted, setMounted] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
  const [hasEnvToken, setHasEnvToken] = useState<boolean>(Boolean(propHasEnvToken));
  const [isLoggingInOAuth, setIsLoggingInOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRaindropToken(settings.raindropToken);
      setOauthError(null);

      fetch('/api/auth/config')
        .then((res) => res.json())
        .then((data) => {
          setOauthConfigured(Boolean(data.oauthConfigured));
          if (data.hasEnvToken !== undefined) {
            setHasEnvToken(Boolean(data.hasEnvToken));
          }
        })
        .catch(() => setOauthConfigured(false));
    }
  }, [isOpen, settings]);

  if (!isOpen || !mounted) return null;

  const handleOAuthLogin = async () => {
    setIsLoggingInOAuth(true);
    setOauthError(null);
    try {
      const res = await fetch('/api/auth/login');
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setOauthError(data.message || 'Failed to start OAuth login.');
        setIsLoggingInOAuth(false);
      }
    } catch (err: any) {
      setOauthError(`Network error: ${err.message}`);
      setIsLoggingInOAuth(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      raindropToken,
    });
    onClose();
  };

  const handleDisconnect = () => {
    setRaindropToken('');
    onSaveSettings({ ...settings, raindropToken: '' });
    onClose();
  };

  const themeOptions: { mode: ThemeMode; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      mode: 'system',
      title: 'Auto / OS',
      desc: 'Follow system appearance',
      icon: <Laptop className="w-4 h-4" />,
    },
    {
      mode: 'light',
      title: 'Light',
      desc: 'Warm cream & terracotta',
      icon: <Sun className="w-4 h-4" />,
    },
    {
      mode: 'dark',
      title: 'Dark',
      desc: 'Deep warm obsidian',
      icon: <Moon className="w-4 h-4" />,
    },
  ];

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-[rgba(0,0,0,0.65)] backdrop-blur-sm flex items-end sm:items-center justify-center transition-colors"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDFA] dark:bg-[#1C1916] text-[#2E2A26] dark:text-[#F5EFEA] border border-[#EAE0D4] dark:border-[#2E2924] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto shadow-2xl"
      >
        <div className="flex items-start gap-3.5 mb-1.5">
          <h3 className="font-serif text-[27px] text-[#2E2A26] dark:text-[#F5EFEA] flex-1">Settings</h3>
          <button
            id="close-settings-btn"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#2A2520] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mb-5 text-[#8A7E73] dark:text-[#A69B90] text-[14.5px] leading-[1.55]">
          Manage theme preferences, sign in with Raindrop OAuth, or enter a token manually.
        </p>

        {/* Theme Preference Section */}
        <div className="mb-5 p-4 rounded-2xl bg-[#FAF6F0] dark:bg-[#25211D] border border-[#EAE0D4] dark:border-[#332C26]">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2.5">
            Appearance
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const isSelected = themeMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setThemeMode(opt.mode)}
                  className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#C4633E] dark:border-[#E07A52] bg-[#FFF3EA] dark:bg-[#2C1C14] text-[#C4633E] dark:text-[#E07A52] font-medium shadow-sm'
                      : 'border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#6E6459] dark:text-[#A69B90] hover:border-[#C4633E] dark:hover:border-[#E07A52]'
                  }`}
                >
                  <div className={`mb-1.5 ${isSelected ? 'text-[#C4633E] dark:text-[#E07A52]' : ''}`}>
                    {opt.icon}
                  </div>
                  <span className="text-xs font-semibold">{opt.title}</span>
                  <span className="text-[10.5px] opacity-75 mt-0.5 leading-tight hidden sm:inline">
                    {opt.mode === 'system' ? `(${resolvedTheme})` : opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* OAuth Login */}
          <div className="rounded-2xl border border-dashed border-[#DCCFBF] dark:border-[#3D352E] bg-[#FAF6F0]/50 dark:bg-[#25211D]/50 p-[18px] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074]">
                Raindrop Connection
              </span>
              {oauthConfigured === true && (
                <span className="px-2.5 py-1 rounded-full bg-[#EDF1E6] dark:bg-[#1E281C] text-[#4E6140] dark:text-[#8FA87F] text-[11.5px] font-medium">
                  OAuth ready
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#7A6F64] dark:text-[#A69B90] leading-[1.5]">
              A browser redirect grants access — nothing to copy or paste.
            </p>
            {oauthError && <p className="text-[13.5px] text-[#A0433A] dark:text-[#E07A52]">{oauthError}</p>}
            <button
              type="button"
              id="oauth-login-btn"
              onClick={handleOAuthLogin}
              disabled={isLoggingInOAuth}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer transition-transform hover:-translate-y-0.5 disabled:opacity-70"
            >
              {isLoggingInOAuth ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoggingInOAuth ? 'Connecting to Raindrop…' : 'Continue with Raindrop'}
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.12em] text-[#A08F80] dark:text-[#8C8074]">
            <div className="flex-1 h-px bg-[#EAE0D4] dark:bg-[#332C26]" />
            or manual token
            <div className="flex-1 h-px bg-[#EAE0D4] dark:bg-[#332C26]" />
          </div>

          {/* Raindrop Token Field */}
          <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459] dark:text-[#D5CCC3]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>Raindrop token</span>
                {hasEnvToken && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EDF1E6] dark:bg-[#1E281C] text-[#4E6140] dark:text-[#8FA87F] text-[11px] font-medium">
                    RAINDROP_TOKEN env active
                  </span>
                )}
              </div>
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#C4633E] dark:text-[#E07A52] text-[12.5px] hover:underline"
              >
                Get test token <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="raindrop-token-input"
              type="password"
              value={raindropToken}
              onChange={(e) => setRaindropToken(e.target.value)}
              placeholder={hasEnvToken ? 'Using RAINDROP_TOKEN env var (paste to override)' : 'rd_live_…'}
              className="px-3.5 py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FCFAF6] dark:bg-[#25211D] text-[#2E2A26] dark:text-[#F5EFEA] text-[14.5px] font-mono outline-none focus:border-[#C4633E] dark:focus:border-[#E07A52]"
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              id="test-raindrop-token-btn"
              onClick={() => onTestRaindropSync(raindropToken)}
              disabled={isTestingSync || (!raindropToken.trim() && !hasEnvToken)}
              className="px-4 py-2.5 rounded-full border border-[#C4633E] dark:border-[#E07A52] bg-transparent text-[#C4633E] dark:text-[#E07A52] text-[13.5px] font-medium cursor-pointer disabled:opacity-50 hover:bg-[#C4633E]/10 dark:hover:bg-[#E07A52]/10"
            >
              {isTestingSync ? 'Testing connection…' : 'Test Raindrop sync'}
            </button>
            {syncTestMessage && (
              <span className="text-[12.5px] text-[#6E6459] dark:text-[#A69B90] truncate max-w-[280px]">{syncTestMessage}</span>
            )}
          </div>

          <div className="flex gap-2.5 flex-wrap pt-2">
            <button
              type="submit"
              id="save-settings-btn"
              className="px-5 py-3 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
            >
              Save &amp; sync
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-[18px] py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#A0776A] dark:text-[#B89488] text-[14.5px] cursor-pointer hover:border-[#C4633E] dark:hover:border-[#E07A52]"
            >
              Disconnect
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

