'use client';

import React from 'react';
import { RefreshCw, Settings as SettingsIcon, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onRefreshRaindrop: () => void;
  isFetchingRaindrop: boolean;
  raindropStatus?: 'success' | 'partial' | 'error' | 'idle';
  hasRaindropToken?: boolean;
  onResetAll?: () => void;
  characterCount?: number;
  styleCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onRefreshRaindrop,
  isFetchingRaindrop,
  hasRaindropToken,
  onResetAll,
}) => {
  const statusLabel = hasRaindropToken ? 'connected · raindrop' : 'offline';

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2.5 sm:gap-4 flex-wrap px-4 sm:px-6 lg:px-10 py-3.5 bg-[#FAF6F0]/[0.85] dark:bg-[#141210]/[0.85] backdrop-blur-xl border-b border-[#EAE0D4] dark:border-[#2E2924] transition-colors">
      {/* Brand & App Title */}
      <div className="flex items-center gap-2.5 mr-auto">
        <div className="w-[34px] h-[34px] flex items-center justify-center text-3xl select-none">
          🚿
        </div>
        <div className="leading-none">
          <div className="font-serif text-[23px] tracking-[0.1px] text-[#2E2A26] dark:text-[#F5EFEA]">Shower Studio</div>
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mt-1">
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Reset everything button (left to Re-sync) */}
      {onResetAll && (
        <button
          id="header-reset-everything-btn"
          type="button"
          onClick={onResetAll}
          title="Reset all inputs, cast, and style selections"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52]"
        >
          <RotateCcw className="w-3.5 h-3.5 opacity-60" />
          <span>Reset everything</span>
        </button>
      )}

      {/* Status Indicators & Action Tools */}
      {hasRaindropToken && (
        <button
          id="refresh-raindrop-btn"
          onClick={onRefreshRaindrop}
          disabled={isFetchingRaindrop}
          title="Refetch Shower items from Raindrop.io API"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRaindrop ? 'animate-spin text-[#C4633E] dark:text-[#E07A52]' : 'opacity-45'}`} />
          <span>{isFetchingRaindrop ? 'Syncing…' : 'Re-sync'}</span>
        </button>
      )}

      <button
        id="open-settings-btn"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Settings"
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52]"
      >
        <SettingsIcon className="w-[15px] h-[15px]" />
        <span>Settings</span>
      </button>
    </header>
  );
};

