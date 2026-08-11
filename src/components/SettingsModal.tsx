'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Database, ExternalLink, ShieldCheck, Check, LogIn, Sparkles } from 'lucide-react';
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

      // Check if OAuth is configured on server
      fetch('/api/auth/config')
        ? fetch('/api/auth/config')
            .then((res) => res.json())
            .then((data) => setOauthConfigured(Boolean(data.oauthConfigured)))
            .catch(() => setOauthConfigured(false))
        : setOauthConfigured(false);
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

  return createPortal(
    <div
      className="modal modal-open bg-black/60 backdrop-blur-sm fixed inset-0 z-[999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="modal-box max-w-xl p-0 overflow-hidden bg-base-100 border border-base-300 shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-base-300 bg-base-200/50">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-base-content">Raindrop Authentication</h2>
              <p className="text-sm text-base-content/60 mt-0.5">Connect via OAuth2 Login or manual Bearer Token</p>
            </div>
          </div>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-7 space-y-7">
          {/* OAuth2 Login Section */}
          <div className="p-5 bg-primary/5 rounded-2xl border border-primary/20 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-base-content">
                  Raindrop OAuth2 Quick Login
                </span>
              </div>
              {oauthConfigured === true && (
                <span className="badge badge-success badge-sm">OAuth Ready</span>
              )}
            </div>

            <p className="text-sm text-base-content/70 leading-relaxed">
              Sign in directly with your Raindrop.io account to authorize access without manually generating tokens.
            </p>

            {oauthError && (
              <p className="text-sm text-error font-medium">{oauthError}</p>
            )}

            <button
              type="button"
              id="oauth-login-btn"
              onClick={handleOAuthLogin}
              disabled={isLoggingInOAuth}
              className="btn btn-primary w-full gap-2 shadow-sm"
            >
              {isLoggingInOAuth ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Connecting to Raindrop...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Login with Raindrop.io (OAuth2)
                </>
              )}
            </button>
          </div>

          <div className="divider text-xs text-base-content/40 my-0">OR MANUAL TOKEN</div>

          {/* Raindrop Token Field */}
          <div className="form-control w-full">
            <div className="flex items-center justify-between mb-2 gap-2">
              <label htmlFor="raindrop-token-input" className="label-text font-semibold text-sm text-base-content flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Raindrop API Bearer Token
              </label>
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noreferrer"
                className="link link-primary text-xs flex items-center gap-1 hover:underline shrink-0"
              >
                Get Test Token <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              id="raindrop-token-input"
              type="password"
              value={raindropToken}
              onChange={(e) => setRaindropToken(e.target.value)}
              placeholder="Paste your Raindrop Test Token or OAuth Token..."
              className="input input-bordered w-full font-mono text-sm focus:input-primary"
            />
            <p className="text-xs text-base-content/60 mt-1.5 leading-relaxed">
              Required to fetch Shower characters and styles from your Raindrop collections.
            </p>

            {/* Test Raindrop Connection Button */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                id="test-raindrop-token-btn"
                onClick={() => onTestRaindropSync(raindropToken)}
                disabled={isTestingSync || !raindropToken.trim()}
                className="btn btn-sm btn-outline btn-primary"
              >
                {isTestingSync ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Testing Connection...
                  </>
                ) : (
                  'Test Raindrop Sync'
                )}
              </button>
              {syncTestMessage && (
                <span className="text-xs text-info truncate max-w-[280px]">
                  {syncTestMessage}
                </span>
              )}
            </div>
          </div>

          {/* Security Note */}
          <div className="alert alert-info py-3 px-4 rounded-xl text-sm flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Credentials are kept in secure local state &amp; server environment proxies.</span>
          </div>

          {/* Submit Actions */}
          <div className="modal-action mt-2 pt-2 border-t border-base-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-settings-btn"
              className="btn btn-primary gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
