'use client';

import React, { useState, useEffect } from 'react';
import { X, History, Check, Copy, ExternalLink } from 'lucide-react';
import { Character, StylePack } from '../types';

interface GeneratorControlsProps {
  selectedCharacters: Character[];
  selectedStyle: StylePack | null;
  imageAppUrl?: string;
  raindropToken?: string;
  onResetAll?: () => void;
}

const MODEL_OPTIONS = [
  { value: 'GPT Image 2', label: 'GPT Image 2' },
  { value: 'Gemini 3.1 Flash', label: 'Gemini 3.1 Flash' },
  { value: 'Gemini 3.1 Flash Lite', label: 'Gemini 3.1 Flash Lite' },
];

const ASPECT_RATIOS = [
  { value: 'Auto', label: 'Auto' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '16:9', label: 'Landscape 16:9' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:1', label: 'Landscape 3:1' },
  { value: '9:16', label: 'Portrait 9:16' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '1:3', label: 'Portrait 1:3' },
];

const TEXT_LANGUAGES = [
  { value: 'Auto', label: 'Auto' },
  { value: 'No text', label: 'No text' },
  { value: 'English', label: 'English' },
  { value: '香港繁体粤语', label: '香港繁体粤语' },
];

const INPUTS_STORAGE_KEY = 'raindrop_ai_studio_last_inputs_v1';
const PROMPT_HISTORY_STORAGE_KEY = 'raindrop_ai_studio_prompt_history_v1';

const getSavedControls = () => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse saved inputs:', e);
  }
  return {};
};

const getSavedPromptHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 10);
      }
    }
  } catch (e) {
    console.error('Failed to parse prompt history:', e);
  }
  return [];
};

const selectClasses =
  'w-full px-3.5 py-3 rounded-xl border border-[#E3D8CA] bg-[#FCFAF6] text-[14.5px] text-[#2E2A26] cursor-pointer outline-none focus:border-[#C4633E]';

export const GeneratorControls: React.FC<GeneratorControlsProps> = ({
  selectedCharacters,
  selectedStyle,
  imageAppUrl,
  raindropToken,
  onResetAll,
}) => {
  const saved = getSavedControls();
  const [model, setModel] = useState<string>(saved.model || 'GPT Image 2');
  const [compositionPrompt, setCompositionPrompt] = useState<string>(saved.compositionPrompt || '');
  const [aspectRatio, setAspectRatio] = useState<string>(saved.aspectRatio || 'Auto');
  const [textLanguage, setTextLanguage] = useState<string>(saved.textLanguage || 'Auto');
  const [promptHistory, setPromptHistory] = useState<string[]>(getSavedPromptHistory);
  const [isCopied, setIsCopied] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  // Persist controls state changes to localStorage
  useEffect(() => {
    try {
      const existingSaved = getSavedControls();
      localStorage.setItem(
        INPUTS_STORAGE_KEY,
        JSON.stringify({
          ...existingSaved,
          model,
          compositionPrompt,
          aspectRatio,
          textLanguage,
        })
      );
    } catch (e) {
      console.error('Failed to save controls state to localStorage:', e);
    }
  }, [model, compositionPrompt, aspectRatio, textLanguage]);

  const handleReset = () => {
    setModel('GPT Image 2');
    setCompositionPrompt('');
    setAspectRatio('Auto');
    setTextLanguage('Auto');
    try {
      localStorage.removeItem(INPUTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear inputs from localStorage:', e);
    }
    if (onResetAll) {
      onResetAll();
    }
  };

  const savePromptToHistory = (promptToSave: string) => {
    if (!promptToSave || !promptToSave.trim()) return;
    const trimmed = promptToSave.trim();
    setPromptHistory((prev) => {
      const filtered = prev.filter((p) => p !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save prompt history:', e);
      }
      return updated;
    });
  };

  const handleCopyPrompt = async () => {
    savePromptToHistory(compositionPrompt);

    const charactersStr = selectedCharacters
      .map((c) => (c.title || '').trim())
      .filter(Boolean)
      .join(', ');

    const styleStr = selectedStyle ? (selectedStyle.title || '').trim() : '';

    const promptData = {
      characters: charactersStr,
      style: styleStr,
      model: model,
      ratio: aspectRatio,
      language: textLanguage,
      instruction: compositionPrompt,
    };

    const jsonString = JSON.stringify(promptData, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt to clipboard:', err);
    }
  };

  const handleOpenApp = async () => {
    savePromptToHistory(compositionPrompt);
    setAppError(null);

    if (!raindropToken || !raindropToken.trim()) {
      setAppError('No valid connection — add a token to continue.');
      return;
    }

    const charactersStr = selectedCharacters
      .map((c) => (c.title || '').trim())
      .filter(Boolean)
      .join(', ');

    const styleStr = selectedStyle ? (selectedStyle.title || '').trim() : '';

    const promptData = {
      characters: charactersStr,
      style: styleStr,
      model: model,
      ratio: aspectRatio,
      language: textLanguage,
    };

    const jsonString = JSON.stringify(promptData, null, 2);

    const newTab = window.open('about:blank', '_blank');
    setIsOpeningApp(true);

    try {
      const res = await fetch('/api/raindrop/app-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raindropToken }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success' && data.imageAppUrl) {
        const baseUrl = data.imageAppUrl;
        const delimiter = baseUrl.includes('?') ? '&' : '?';
        const finalUrl = `${baseUrl}${delimiter}instruction=${encodeURIComponent(compositionPrompt)}&json=${encodeURIComponent(jsonString)}`;

        if (newTab) {
          newTab.location.href = finalUrl;
        } else {
          window.open(finalUrl, '_blank');
        }
      } else {
        if (newTab) newTab.close();
        setAppError(
          data?.message || 'Could not resolve Image Generation App URL from Raindrop ("Shower > Apps > Image generation app").'
        );
      }
    } catch (e: any) {
      if (newTab) newTab.close();
      console.error('Failed to resolve imageAppUrl at runtime:', e);
      setAppError(`Failed to resolve app URL from Raindrop: ${e?.message || 'Network error'}`);
    } finally {
      setIsOpeningApp(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isOpeningApp) {
        handleOpenApp();
      }
    }
  };

  const handleDeletePromptFromHistory = (promptToDelete: string) => {
    setPromptHistory((prev) => {
      const updated = prev.filter((p) => p !== promptToDelete);
      try {
        if (updated.length === 0) {
          localStorage.removeItem(PROMPT_HISTORY_STORAGE_KEY);
        } else {
          localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Failed to update prompt history:', e);
      }
      return updated;
    });
  };

  const castSummary = selectedCharacters.length
    ? selectedCharacters.map((c) => c.title).join(' · ')
    : 'No characters selected yet';
  const styleSummary = selectedStyle ? selectedStyle.title : 'No style selected yet';

  return (
    <section
      id="composition-section"
      className="scroll-mt-20 rounded-[26px] p-5 sm:p-7 bg-[#FFFDFA] border border-[#EAE0D4] shadow-[0_20px_50px_-34px_rgba(88,66,48,0.55)]"
    >
      <div className="flex items-baseline gap-3.5 flex-wrap">
        <span className="font-mono text-[11px] tracking-[0.16em] text-[#C4633E]">STEP 03</span>
        <h2 className="font-serif font-normal text-[26px] sm:text-[34px] text-[#2E2A26]">Compose &amp; hand off</h2>
      </div>

      {/* Selected Items Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-[18px] mb-[22px]">
        <div className="rounded-2xl bg-[#FAF5EE] px-4 py-3.5">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">Cast</div>
          <div className={`text-[14.5px] leading-[1.5] ${selectedCharacters.length ? 'text-[#4F4740]' : 'text-[#A79C92]'}`}>
            {castSummary}
          </div>
        </div>
        <div className="rounded-2xl bg-[#FAF5EE] px-4 py-3.5">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">Style</div>
          <div className={`text-[14.5px] leading-[1.5] ${selectedStyle ? 'text-[#4F4740]' : 'text-[#A79C92]'}`}>
            {styleSummary}
          </div>
        </div>
      </div>

      {/* Composition Prompt Entry */}
      <label htmlFor="composition-prompt-textarea" className="block text-sm font-medium text-[#2E2A26] mb-2">
        Composition
      </label>
      <textarea
        id="composition-prompt-textarea"
        value={compositionPrompt}
        onChange={(e) => setCompositionPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        placeholder="Golden hour on a rooftop, the two of them mid-laugh, shot from below…"
        className="w-full resize-vertical px-4 py-3.5 rounded-2xl border border-[#E3D8CA] bg-[#FCFAF6] text-[15px] leading-[1.55] text-[#2E2A26] outline-none focus:border-[#C4633E]"
      />

      <div className="flex flex-wrap gap-2.5 items-center mt-2.5">
        {compositionPrompt && (
          <button
            type="button"
            id="clear-composition-prompt-btn"
            onClick={() => setCompositionPrompt('')}
            className="px-3 py-1.5 rounded-full border border-[#E3D8CA] bg-transparent text-[#8A7E73] text-[12.5px]"
          >
            Clear text
          </button>
        )}
        <span className="font-mono text-[11.5px] text-[#A08F80]">⌘↵ opens the app</span>
      </div>

      {/* Prompt History Pills */}
      {promptHistory.length > 0 && (
        <div className="mt-4">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Recent prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {promptHistory.map((histPrompt, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-full bg-[#F6F0E7] border border-[#EBE1D4] max-w-full"
              >
                <button
                  type="button"
                  onClick={() => setCompositionPrompt(histPrompt)}
                  className="text-[13px] text-[#6E6459] truncate max-w-[34ch]"
                  title={histPrompt}
                >
                  {histPrompt}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePromptFromHistory(histPrompt);
                  }}
                  className="text-[#B0A396] hover:text-[#A0433A] shrink-0"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Select Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-[22px]">
        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459]">
          Model
          <select id="model-select" value={model} onChange={(e) => setModel(e.target.value)} className={selectClasses}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459]">
          Aspect ratio
          <select
            id="aspect-ratio-select"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className={selectClasses}
          >
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar.value} value={ar.value}>
                {ar.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459]">
          Text language
          <select
            id="text-language-select"
            value={textLanguage}
            onChange={(e) => setTextLanguage(e.target.value)}
            className={selectClasses}
          >
            {TEXT_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center mt-6 pt-5 border-t border-[#F0E7DA]">
        <button
          type="button"
          id="open-app-btn"
          onClick={handleOpenApp}
          disabled={isOpeningApp}
          title="Open Image Generation App with prompt parameters"
          className="flex items-center justify-center gap-2 px-[22px] py-3.5 rounded-2xl border-none bg-[#C4633E] text-[#FFF7F1] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer shadow-[0_12px_24px_-14px_rgba(196,99,62,0.95)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {isOpeningApp ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          <span>{isOpeningApp ? 'Opening…' : 'Open image app ↗'}</span>
        </button>

        <button
          type="button"
          id="copy-prompt-btn"
          onClick={handleCopyPrompt}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-[#D6C8B8] bg-[#FFFDFA] text-[#5B5148] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied ✓</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy payload</span>
            </>
          )}
        </button>

        <div className="flex-1 min-w-2" />

        <button
          type="button"
          onClick={handleReset}
          title="Reset all inputs"
          className="px-4 py-3 rounded-2xl border-none bg-transparent text-[#A0776A] text-[14px] whitespace-nowrap shrink-0 cursor-pointer underline underline-offset-[3px]"
        >
          Reset everything
        </button>
      </div>

      {appError && (
        <div className="mt-4 text-sm text-[#96402F] bg-[#FBEAE5] border border-[#F1D3C9] rounded-xl px-4 py-2.5">
          {appError}
        </div>
      )}
    </section>
  );
};
