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
    <header className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-md border-b border-base-300 px-4 lg:px-8 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 h-10 rounded-xl ring-1 ring-base-300 bg-base-200 p-0.5 shadow-xs">
              <img
                src="/app-icon.svg"
                alt="Shower App Icon"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-base-content flex items-center gap-2">
              Shower
              <span className="badge badge-primary badge-outline text-xs px-2 py-1 font-medium">
                Shower Studio
              </span>
            </h1>
            <p className="text-xs text-base-content/60">
              Compose prompts from Raindrop character collections &amp; style packs
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Tools */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Refresh Raindrop Button - Hidden until Raindrop API token is provided */}
          {hasRaindropToken && (
            <button
              id="refresh-raindrop-btn"
              onClick={onRefreshRaindrop}
              disabled={isFetchingRaindrop}
              className="btn btn-sm btn-ghost border border-base-300 hover:border-primary gap-2 transition disabled:opacity-50"
              title="Refetch Shower items from Raindrop.io API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRaindrop ? 'animate-spin text-primary' : ''}`} />
              <span>{isFetchingRaindrop ? 'Fetching...' : 'Sync Raindrop'}</span>
            </button>
          )}

          {/* Settings Toggle Button */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="btn btn-sm btn-primary gap-1.5 shadow-sm"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
