'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Database, ExternalLink, ShieldCheck, Check } from 'lucide-react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRaindropToken(settings.raindropToken);
    }
  }, [isOpen, settings]);

  if (!isOpen || !mounted) return null;

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-base-content">API Credentials &amp; Configuration</h2>
              <p className="text-xs text-base-content/60">Configure Raindrop API Bearer Token</p>
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
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Raindrop Token Field */}
          <div className="form-control w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="raindrop-token-input" className="label-text font-semibold text-xs text-base-content flex items-center gap-1.5">
                <Database className="w-4 h-4 text-primary" />
                Raindrop API Bearer Token
              </label>
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noreferrer"
                className="link link-primary text-[11px] flex items-center gap-1 hover:underline"
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
            <p className="text-[11px] text-base-content/60 mt-1">
              Required to fetch Shower characters and styles from your Raindrop collections.
            </p>

            {/* Test Raindrop Connection Button */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                id="test-raindrop-token-btn"
                onClick={() => onTestRaindropSync(raindropToken)}
                disabled={isTestingSync || !raindropToken.trim()}
                className="btn btn-xs btn-outline btn-primary"
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
          <div className="alert alert-info py-2.5 px-3 rounded-xl text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Credentials are kept in secure local state &amp; server environment proxies.</span>
          </div>

          {/* Submit Actions */}
          <div className="modal-action mt-6 pt-2 border-t border-base-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-settings-btn"
              className="btn btn-sm btn-primary gap-1.5"
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
