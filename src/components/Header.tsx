'use client';

import React from 'react';
import { RefreshCw, Settings as SettingsIcon } from 'lucide-react';

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
  const statusLabel = hasRaindropToken ? 'connected · raindrop' : 'offline';

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 flex-wrap px-4 sm:px-6 lg:px-10 py-3.5 bg-[#FAF6F0]/[0.82] backdrop-blur-xl border-b border-[#EAE0D4]">
      {/* Brand & App Title */}
      <div className="flex items-center gap-2.5 mr-auto">
        <div className="w-[34px] h-[34px] flex items-center justify-center text-3xl">
          🚿
        </div>
        <div className="leading-none">
          <div className="font-serif text-[23px] tracking-[0.1px] text-[#2E2A26]">Shower Studio</div>
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mt-1">
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Status Indicators & Action Tools */}
      {hasRaindropToken && (
        <button
          id="refresh-raindrop-btn"
          onClick={onRefreshRaindrop}
          disabled={isFetchingRaindrop}
          title="Refetch Shower items from Raindrop.io API"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-[#E3D8CA] bg-[#FFFDFA] text-[#5B5148] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] hover:text-[#C4633E] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRaindrop ? 'animate-spin text-[#C4633E]' : 'opacity-45'}`} />
          <span>{isFetchingRaindrop ? 'Syncing…' : 'Re-sync'}</span>
        </button>
      )}

      <button
        id="open-settings-btn"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Settings"
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-[#E3D8CA] bg-[#FFFDFA] text-[#5B5148] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] hover:text-[#C4633E]"
      >
        <SettingsIcon className="w-[15px] h-[15px]" />
        <span>Settings</span>
      </button>
    </header>
  );
};
