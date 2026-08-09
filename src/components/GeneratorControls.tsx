'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Frame, Globe, User, Palette, X, History, Cpu, RotateCcw, Copy, Check, ExternalLink } from 'lucide-react';
import { Character, StylePack, ImageGenerationParams } from '../types';

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
      setAppError('Raindrop API Token is missing. Please enter your token in Settings to open the app.');
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
      instruction: compositionPrompt,
    };

    const jsonString = JSON.stringify(promptData);

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
        const finalUrl = `${baseUrl}${delimiter}json=${encodeURIComponent(jsonString)}`;

        if (newTab) {
          newTab.location.href = finalUrl;
        } else {
          window.open(finalUrl, '_blank');
        }
      } else {
        if (newTab) newTab.close();
        setAppError(
          data?.message || 'Could not resolve Image Generation App URL from Raindrop in runtime ("Shower > Apps > Image generation app").'
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

  const handleClearPromptHistory = () => {
    setPromptHistory([]);
    try {
      localStorage.removeItem(PROMPT_HISTORY_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear prompt history:', e);
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

  return (
    <div id="composition-section" className="scroll-mt-20 bg-base-100 border border-base-300 rounded-2xl p-5 backdrop-blur-sm space-y-5 shadow-sm">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-base-300">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-accent/10 text-accent rounded-xl border border-accent/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-base-content">3. Composition &amp; Parameters</h2>
          </div>
        </div>
      </div>

      {/* Selected Items Summary Chips */}
      <div className="bg-base-200/60 rounded-xl p-3 border border-base-300 space-y-2">
        <h3 className="text-[11px] font-semibold text-base-content/60 uppercase tracking-wider">Active Shower Selection</h3>
        <div className="flex flex-wrap gap-2">
          {/* Selected Characters */}
          {selectedCharacters.length === 0 ? (
            <span className="badge badge-ghost text-xs">
              No Characters Selected
            </span>
          ) : (
            selectedCharacters.map((char) => (
              <span
                key={char.id}
                className="badge badge-primary gap-1.5 py-3 px-3 text-xs"
              >
                {char.cover && (
                  <img
                    src={char.cover}
                    alt={char.title}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <User className="w-3 h-3" />
                <span className="font-medium">{char.title}</span>
              </span>
            ))
          )}

          {/* Selected Style */}
          {selectedStyle ? (
            <span className="badge badge-secondary gap-1.5 py-3 px-3 text-xs">
              {selectedStyle.preview_cover && (
                <img
                  src={selectedStyle.preview_cover}
                  alt={selectedStyle.title}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover"
                />
              )}
              <Palette className="w-3 h-3" />
              <span className="font-medium">{selectedStyle.title}</span>
            </span>
          ) : (
            <span className="badge badge-ghost text-xs">
              No Style Selected
            </span>
          )}
        </div>
      </div>

      {/* Composition Prompt Entry */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="composition-prompt-textarea" className="label-text font-semibold text-xs text-base-content flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" />
            Composition Prompt
          </label>
          <div className="flex items-center gap-2">
            {compositionPrompt && (
              <button
                type="button"
                id="clear-composition-prompt-btn"
                onClick={() => setCompositionPrompt('')}
                className="btn btn-xs btn-ghost text-error gap-1"
                title="Clear composition prompt content"
              >
                <X className="w-3 h-3" />
                <span>Clear Prompt</span>
              </button>
            )}
            <span className="text-[11px] text-base-content/60 flex items-center gap-1.5">
              <span className="hidden sm:inline">Describe the scene action or framing</span>
              <kbd className="kbd kbd-xs">⌘+Enter to Open App</kbd>
            </span>
          </div>
        </div>
        <div className="relative">
          <textarea
            id="composition-prompt-textarea"
            value={compositionPrompt}
            onChange={(e) => setCompositionPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            placeholder="Describe how the characters interact, environment, camera angle, action, or mood..."
            className="textarea textarea-bordered w-full text-xs focus:textarea-accent min-h-[120px]"
          />
          {compositionPrompt && (
            <button
              type="button"
              onClick={() => setCompositionPrompt('')}
              className="absolute top-2.5 right-2.5 btn btn-xs btn-ghost btn-circle"
              title="Clear prompt content"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Prompt History Pills */}
        {promptHistory.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-base-content/60 flex items-center gap-1">
              <History className="w-3 h-3 text-accent" /> History Prompts:
            </span>
            {promptHistory.map((histPrompt, idx) => (
              <div
                key={idx}
                className="badge badge-outline gap-1 py-2 px-2 text-[10px] max-w-[240px]"
              >
                <button
                  type="button"
                  onClick={() => setCompositionPrompt(histPrompt)}
                  className="truncate font-medium text-left"
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
                  className="hover:text-error shrink-0"
                  title="Delete prompt from history"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleClearPromptHistory}
              className="text-[10px] text-base-content/60 hover:text-error transition ml-1 underline"
              title="Clear all prompt history"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Select Controls: Model, Aspect Ratio & Text Language */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Model Select */}
        <div className="form-control">
          <label htmlFor="model-select" className="label py-1">
            <span className="label-text text-xs font-semibold text-base-content flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent" />
              AI Model
            </span>
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="select select-bordered select-sm w-full text-xs focus:select-accent"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Aspect Ratio Select */}
        <div className="form-control">
          <label htmlFor="aspect-ratio-select" className="label py-1">
            <span className="label-text text-xs font-semibold text-base-content flex items-center gap-1.5">
              <Frame className="w-4 h-4 text-primary" />
              Aspect Ratio
            </span>
          </label>
          <select
            id="aspect-ratio-select"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="select select-bordered select-sm w-full text-xs focus:select-primary"
          >
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar.value} value={ar.value}>
                {ar.label}
              </option>
            ))}
          </select>
        </div>

        {/* Text Language Select */}
        <div className="form-control">
          <label htmlFor="text-language-select" className="label py-1">
            <span className="label-text text-xs font-semibold text-base-content flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-secondary" />
              Text Language
            </span>
          </label>
          <select
            id="text-language-select"
            value={textLanguage}
            onChange={(e) => setTextLanguage(e.target.value)}
            className="select select-bordered select-sm w-full text-xs focus:select-secondary"
          >
            {TEXT_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-base-300 flex items-center justify-end gap-3 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          onClick={handleReset}
          className="btn btn-sm btn-ghost border border-base-300 hover:btn-error gap-1.5"
          title="Reset all inputs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All</span>
        </button>

        <button
          type="button"
          id="copy-prompt-btn"
          onClick={handleCopyPrompt}
          className="btn btn-sm btn-outline gap-2"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4 text-success" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy prompt</span>
            </>
          )}
        </button>

        <button
          type="button"
          id="open-app-btn"
          onClick={handleOpenApp}
          disabled={isOpeningApp}
          title="Open Image Generation App with prompt parameters"
          className="btn btn-sm btn-primary gap-2"
        >
          {isOpeningApp ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              <span>Opening...</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              <span>Open App</span>
            </>
          )}
        </button>
      </div>

      {appError && (
        <div className="alert alert-error text-xs py-2 rounded-xl mt-1">
          <span>{appError}</span>
        </div>
      )}
    </div>
  );
};
