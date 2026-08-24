'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, LogIn } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onTestRaindropSync: (token: string) => Promise<void>;
  isTestingSync: boolean;
  syncTestMessage: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onTestRaindropSync,
  isTestingSync,
  syncTestMessage,
}) => {
  const [raindropToken, setRaindropToken] = useState(settings.raindropToken);
  const [mounted, setMounted] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
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
        .then((data) => setOauthConfigured(Boolean(data.oauthConfigured)))
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

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDFA] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
      >
        <div className="flex items-start gap-3.5 mb-1.5">
          <h3 className="font-serif text-[27px] text-[#2E2A26] flex-1">Settings</h3>
          <button
            id="close-settings-btn"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mb-5 text-[#8A7E73] text-[14.5px] leading-[1.55]">
          Paste a Raindrop token to connect manually, or sign in with OAuth. It stays on this device.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* OAuth Login */}
          <div className="rounded-2xl border border-dashed border-[#DCCFBF] p-[18px] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80]">
                Recommended
              </span>
              {oauthConfigured === true && (
                <span className="px-2.5 py-1 rounded-full bg-[#EDF1E6] text-[#4E6140] text-[11.5px] font-medium">
                  OAuth ready
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#7A6F64] leading-[1.5]">
              A browser redirect grants access — nothing to copy or paste.
            </p>
            {oauthError && <p className="text-[13.5px] text-[#A0433A]">{oauthError}</p>}
            <button
              type="button"
              id="oauth-login-btn"
              onClick={handleOAuthLogin}
              disabled={isLoggingInOAuth}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] font-medium cursor-pointer disabled:opacity-70"
            >
              {isLoggingInOAuth ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoggingInOAuth ? 'Connecting to Raindrop…' : 'Continue with Raindrop'}
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.12em] text-[#A08F80]">
            <div className="flex-1 h-px bg-[#EAE0D4]" />
            or manual token
            <div className="flex-1 h-px bg-[#EAE0D4]" />
          </div>

          {/* Raindrop Token Field */}
          <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459]">
            <div className="flex items-center justify-between gap-2">
              <span>Raindrop token</span>
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#C4633E] text-[12.5px] hover:text-[#9E4A29]"
              >
                Get test token <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="raindrop-token-input"
              type="password"
              value={raindropToken}
              onChange={(e) => setRaindropToken(e.target.value)}
              placeholder="rd_live_…"
              className="px-3.5 py-3 rounded-xl border border-[#E3D8CA] bg-[#FCFAF6] text-[14.5px] font-mono outline-none focus:border-[#C4633E]"
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              id="test-raindrop-token-btn"
              onClick={() => onTestRaindropSync(raindropToken)}
              disabled={isTestingSync || !raindropToken.trim()}
              className="px-4 py-2.5 rounded-full border border-[#C4633E] bg-transparent text-[#C4633E] text-[13.5px] font-medium disabled:opacity-50"
            >
              {isTestingSync ? 'Testing connection…' : 'Test Raindrop sync'}
            </button>
            {syncTestMessage && (
              <span className="text-[12.5px] text-[#6E6459] truncate max-w-[280px]">{syncTestMessage}</span>
            )}
          </div>

          <div className="flex gap-2.5 flex-wrap pt-2">
            <button
              type="submit"
              id="save-settings-btn"
              className="px-5 py-3 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] font-medium cursor-pointer"
            >
              Save &amp; sync
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-[18px] py-3 rounded-xl border border-[#E3D8CA] bg-transparent text-[#A0776A] text-[14.5px] cursor-pointer"
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
