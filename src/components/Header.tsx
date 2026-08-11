'use client';

import React from 'react';
import { RefreshCw, Settings } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onRefreshRaindrop: () => void;
  isFetchingRaindrop: boolean;
  raindropStatus?: 'success' | 'partial' | 'error' | 'idle';
  hasRaindropToken?: boolean;
  characterCount?: number;
  styleCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onRefreshRaindrop,
  isFetchingRaindrop,
  hasRaindropToken,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-300 px-5 lg:px-10 py-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3.5">
          <div className="avatar">
            <div className="w-11 h-11 rounded-2xl ring-1 ring-base-300 bg-base-200 p-1 shadow-sm">
              <img
                src="/app-icon.svg"
                alt="Shower App Icon"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-base-content leading-tight">
              Shower Studio
            </h1>
            <p className="text-sm text-base-content/60 mt-0.5">
              Compose prompts from your character &amp; style collections
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Tools */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Refresh Raindrop Button - Hidden until Raindrop API token is provided */}
          {hasRaindropToken && (
            <button
              id="refresh-raindrop-btn"
              onClick={onRefreshRaindrop}
              disabled={isFetchingRaindrop}
              className="btn btn-ghost border border-base-300 hover:border-primary gap-2 transition disabled:opacity-50"
              title="Refetch Shower items from Raindrop.io API"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingRaindrop ? 'animate-spin text-primary' : ''}`} />
              <span>{isFetchingRaindrop ? 'Syncing…' : 'Sync Raindrop'}</span>
            </button>
          )}

          {/* Settings Toggle Button */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="btn btn-primary gap-2 shadow-sm"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
