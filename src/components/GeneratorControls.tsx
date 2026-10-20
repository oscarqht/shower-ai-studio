'use client';

import React, { useState, useEffect } from 'react';
import { Check, Copy, ExternalLink, Sparkles, BookmarkPlus, History, X } from 'lucide-react';
import { Character, StylePack, Preset, MODEL_OPTIONS } from '../types';
import { FinalPromptModal } from './FinalPromptModal';

interface GeneratorControlsProps {
  selectedCharacters: Character[];
  selectedAddOnsByCharacterId: Record<string, string[]>;
  selectedStyle: StylePack | null;
  selectedPreset?: Preset | null;
  compositionPrompt?: string;
  onCompositionPromptChange?: (value: string) => void;
  model?: string;
  onModelChange?: (value: string) => void;
  aspectRatio?: string;
  onAspectRatioChange?: (value: string) => void;
  textLanguage?: string;
  onTextLanguageChange?: (value: string) => void;
  raindropToken?: string;
  onResetAll?: () => void;
  onSaveAsPreset?: (payload: {
    prompt: string;
    model: string;
    aspectRatio: string;
    textLanguage: string;
    stylePackName?: string;
    characterNames?: string[];
  }) => void;
}

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
const RECENT_PROMPTS_STORAGE_KEY = 'raindrop_ai_studio_recent_prompts_v1';
const MAX_RECENT_PROMPTS = 10;

const getSavedRecentPrompts = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(RECENT_PROMPTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .slice(0, MAX_RECENT_PROMPTS);
      }
    }
  } catch (e) {
    console.error('Failed to parse recent prompts:', e);
  }
  return [];
};

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

const selectClasses =
  'w-full px-3.5 py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FCFAF6] dark:bg-[#25211D] text-[14.5px] text-[#2E2A26] dark:text-[#F5EFEA] cursor-pointer outline-none focus:border-[#C4633E] dark:focus:border-[#E07A52] transition-colors';

export const GeneratorControls: React.FC<GeneratorControlsProps> = ({
  selectedCharacters,
  selectedAddOnsByCharacterId,
  selectedStyle,
  selectedPreset,
  compositionPrompt: compositionPromptProp,
  onCompositionPromptChange,
  model: modelProp,
  onModelChange,
  aspectRatio: aspectRatioProp,
  onAspectRatioChange,
  textLanguage: textLanguageProp,
  onTextLanguageChange,
  raindropToken,
  onResetAll,
  onSaveAsPreset,
}) => {
  const getCharactersPrompt = () => selectedCharacters
    .map((character) => {
      const title = (character.title || '').trim();
      if (!title) return '';
      const selectedAddOns = selectedAddOnsByCharacterId[String(character.id)] || [];
      const addOns = (character.addOns || []).filter((text) => selectedAddOns.includes(text));
      return addOns.length ? `${title} (${addOns.join('; ')})` : title;
    })
    .filter(Boolean)
    .join(', ');
  const saved = getSavedControls();
  const [internalModel, setInternalModel] = useState<string>(
    saved.model && saved.model !== 'GPT Image 2' ? saved.model : 'GPT 2.5 Sunburst'
  );
  const [internalCompositionPrompt, setInternalCompositionPrompt] = useState<string>(saved.compositionPrompt || '');
  const [internalAspectRatio, setInternalAspectRatio] = useState<string>(saved.aspectRatio || 'Auto');
  const [internalTextLanguage, setInternalTextLanguage] = useState<string>(saved.textLanguage || 'Auto');

  const isControlledModel = modelProp !== undefined;
  const isControlledPrompt = compositionPromptProp !== undefined;
  const isControlledAspect = aspectRatioProp !== undefined;
  const isControlledLang = textLanguageProp !== undefined;

  const model = isControlledModel ? modelProp : internalModel;
  const compositionPrompt = isControlledPrompt ? compositionPromptProp : internalCompositionPrompt;
  const aspectRatio = isControlledAspect ? aspectRatioProp : internalAspectRatio;
  const textLanguage = isControlledLang ? textLanguageProp : internalTextLanguage;

  const setModel = (val: string) => {
    if (onModelChange) onModelChange(val);
    if (!isControlledModel) setInternalModel(val);
  };
  const setCompositionPrompt = (val: string) => {
    if (onCompositionPromptChange) onCompositionPromptChange(val);
    if (!isControlledPrompt) setInternalCompositionPrompt(val);
  };
  const setAspectRatio = (val: string) => {
    if (onAspectRatioChange) onAspectRatioChange(val);
    if (!isControlledAspect) setInternalAspectRatio(val);
  };
  const setTextLanguage = (val: string) => {
    if (onTextLanguageChange) onTextLanguageChange(val);
    if (!isControlledLang) setInternalTextLanguage(val);
  };

  const [isCopied, setIsCopied] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isStyleCopied, setIsStyleCopied] = useState(false);
  const [isFinalPromptModalOpen, setIsFinalPromptModalOpen] = useState(false);

  // Recent Prompts State (max 10 prompts, persisted in localStorage)
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  useEffect(() => {
    setRecentPrompts(getSavedRecentPrompts());
  }, []);

  const addRecentPrompt = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setRecentPrompts((prev) => {
      const filtered = prev.filter((p) => p !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_PROMPTS);
      try {
        localStorage.setItem(RECENT_PROMPTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent prompt:', e);
      }
      return updated;
    });
  };

  const handleDeleteRecentPrompt = (promptToDelete: string) => {
    setRecentPrompts((prev) => {
      const updated = prev.filter((p) => p !== promptToDelete);
      try {
        localStorage.setItem(RECENT_PROMPTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update recent prompts after deletion:', e);
      }
      return updated;
    });
  };

  const handleClearAllRecentPrompts = () => {
    setRecentPrompts([]);
    try {
      localStorage.removeItem(RECENT_PROMPTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear recent prompts:', e);
    }
  };

  const handleApplyRecentPrompt = (promptText: string) => {
    setCompositionPrompt(promptText);
    addRecentPrompt(promptText);
  };

  const handlePromptBlur = () => {
    if (compositionPrompt && compositionPrompt.trim().length >= 3) {
      addRecentPrompt(compositionPrompt);
    }
  };

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
    setModel('GPT 2.5 Sunburst');
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
    if (compositionPrompt?.trim()) {
      addRecentPrompt(compositionPrompt);
    }

    const charactersStr = getCharactersPrompt();

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

  const handleSaveAsPreset = () => {
    if (compositionPrompt?.trim()) {
      addRecentPrompt(compositionPrompt);
    }

    if (onSaveAsPreset) {
      onSaveAsPreset({
        prompt: compositionPrompt,
        model: model,
        aspectRatio: aspectRatio,
        textLanguage: textLanguage,
        stylePackName: selectedStyle ? (selectedStyle.title || '').trim() : '',
        characterNames: selectedCharacters.map((c) => (c.title || '').trim()).filter(Boolean),
      });
    }
  };

  const handleOpenApp = async () => {
    if (compositionPrompt?.trim()) {
      addRecentPrompt(compositionPrompt);
    }
    setAppError(null);

    if (!raindropToken || !raindropToken.trim()) {
      setAppError('No valid connection — add a token to continue.');
      return;
    }

    const charactersStr = getCharactersPrompt();

    const styleStr = selectedStyle ? (selectedStyle.title || '').trim() : '';

    const promptData = {
      characters: charactersStr,
      style: styleStr,
      model: model,
      ratio: aspectRatio,
      language: textLanguage,
    };

    const jsonString = JSON.stringify(promptData, null, 2);

    setIsOpeningApp(true);

    try {
      const res = await fetch('/api/raindrop/app-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raindropToken }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success' && data.imageAppUrl) {
        const appUrl = new URL(data.imageAppUrl);
        appUrl.searchParams.set('instruction', compositionPrompt);
        appUrl.searchParams.set('json', jsonString);

        appUrl.searchParams.delete('attachment_file_ids');
        appUrl.searchParams.set('_auto_', appUrl.searchParams.get('_auto_') || 'true');

        window.open(appUrl.toString(), '_blank');
      } else {
        setAppError(
          data?.message || 'Could not resolve Image Generation App URL from Raindrop ("Shower > Apps > Image generation app").'
        );
      }
    } catch (e: any) {
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

  const castSummary = selectedCharacters.length
    ? selectedCharacters.map((c) => c.title).join(' · ')
    : 'No characters selected yet';
  const styleSummary = selectedStyle ? selectedStyle.title : 'No style selected yet';

  const handleCopyStyle = async () => {
    if (styleSummary === 'No style selected yet') return;
    try {
      await navigator.clipboard.writeText(styleSummary);
      setIsStyleCopied(true);
      setTimeout(() => setIsStyleCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy style name:', err);
    }
  };

  return (
    <section
      id="composition-section"
      className="scroll-mt-20 rounded-[26px] p-5 sm:p-7 bg-[#FFFDFA] dark:bg-[#1C1916] border border-[#EAE0D4] dark:border-[#2E2924] shadow-[0_20px_50px_-34px_rgba(88,66,48,0.55)] dark:shadow-none transition-colors"
    >
      <div className="flex items-baseline gap-3.5 flex-wrap">
        <h2 className="font-serif font-normal text-[26px] sm:text-[34px] text-[#2E2A26] dark:text-[#F5EFEA]">Compose &amp; hand off</h2>
      </div>

      {/* Selected Preset Banner */}
      {selectedPreset && (
        <div className="mt-4 px-4 py-3 rounded-2xl bg-[#FFF6EE] dark:bg-[#2C1C14] border border-[#F0D8C4] dark:border-[#4A2E1F] flex items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded-full bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="truncate">
              <span className="text-[#8A7E73] dark:text-[#A69B90] text-[13px] mr-1.5">Preset:</span>
              <strong className="text-[#2E2A26] dark:text-[#F5EFEA] font-medium">{selectedPreset.title}</strong>
            </div>
          </div>
          <span className="font-mono text-[11.5px] text-[#C4633E] dark:text-[#E07A52] bg-[#FFEADA] dark:bg-[#3D2518] px-2.5 py-0.5 rounded-full shrink-0">
            Recipe active
          </span>
        </div>
      )}

      {/* Selected Items Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-[18px] mb-[22px]">
        <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] px-4 py-3.5 border border-transparent dark:border-[#2E2924]">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2">Cast</div>
          <div className={`text-[14.5px] leading-[1.5] ${selectedCharacters.length ? 'text-[#4F4740] dark:text-[#D5CCC3]' : 'text-[#A79C92] dark:text-[#7A7066]'}`}>
            {castSummary}
          </div>
        </div>
        <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] px-4 py-3.5 relative flex flex-col justify-center group border border-transparent dark:border-[#2E2924]">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2">Style</div>
          <div className="flex items-center justify-between gap-2">
            <div className={`text-[14.5px] leading-[1.5] ${selectedStyle ? 'text-[#4F4740] dark:text-[#D5CCC3]' : 'text-[#A79C92] dark:text-[#7A7066]'}`}>
              {styleSummary}
            </div>
            {selectedStyle && (
              <button
                type="button"
                onClick={handleCopyStyle}
                title="Copy style name"
                className="p-1.5 rounded-lg border border-[#EBE1D4] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#8A7E73] dark:text-[#A69B90] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA] hover:bg-[#F6F0E7] dark:hover:bg-[#2A2520] transition-colors cursor-pointer"
              >
                {isStyleCopied ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-[#8FA87F]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Composition Prompt Entry */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <label htmlFor="composition-prompt-textarea" className="block text-sm font-medium text-[#2E2A26] dark:text-[#F5EFEA]">
          Composition
        </label>
        {compositionPrompt && (
          <span className="text-[12px] font-mono text-[#A79C92] dark:text-[#7A7066]">
            {compositionPrompt.length} chars
          </span>
        )}
      </div>
      <textarea
        id="composition-prompt-textarea"
        value={compositionPrompt}
        onChange={(e) => setCompositionPrompt(e.target.value)}
        onBlur={handlePromptBlur}
        onKeyDown={handleKeyDown}
        rows={4}
        placeholder="Golden hour on a rooftop, the two of them mid-laugh, shot from below…"
        className="w-full resize-vertical px-4 py-3.5 rounded-2xl border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FCFAF6] dark:bg-[#25211D] text-[15px] leading-[1.55] text-[#2E2A26] dark:text-[#F5EFEA] placeholder:text-[#A79C92] dark:placeholder:text-[#7A7066] outline-none focus:border-[#C4633E] dark:focus:border-[#E07A52] transition-colors"
      />

      <div className="flex flex-wrap gap-2.5 items-center mt-2.5">
        {compositionPrompt && (
          <button
            type="button"
            id="clear-composition-prompt-btn"
            onClick={() => setCompositionPrompt('')}
            className="px-3 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#8A7E73] dark:text-[#A69B90] hover:text-[#C4633E] dark:hover:text-[#E07A52] text-[12.5px] cursor-pointer transition-colors"
          >
            Clear text
          </button>
        )}
        {compositionPrompt.trim().length > 0 && recentPrompts[0] !== compositionPrompt.trim() && (
          <button
            type="button"
            id="remember-prompt-btn"
            onClick={() => addRecentPrompt(compositionPrompt)}
            title="Save to recent prompts"
            className="px-3 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#8A7E73] dark:text-[#A69B90] hover:text-[#C4633E] dark:hover:text-[#E07A52] text-[12.5px] cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
            <span>Remember prompt</span>
          </button>
        )}
        <span className="font-mono text-[11.5px] text-[#A08F80] dark:text-[#7A7066] ml-auto">⌘↵ opens the app</span>
      </div>

      {/* Recent 10 Prompts Section */}
      {recentPrompts.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-[#F0E7DA] dark:border-[#2E2924]" id="recent-prompts-container">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-[0.1em] uppercase text-[#A08F80] dark:text-[#8C8074]">
              <History className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
              <span>Recent prompts ({recentPrompts.length}/10)</span>
            </div>
            <button
              type="button"
              id="clear-all-recents-btn"
              onClick={handleClearAllRecentPrompts}
              className="text-[11px] font-mono text-[#A79C92] dark:text-[#7A7066] hover:text-[#C4633E] dark:hover:text-[#E07A52] transition-colors cursor-pointer"
            >
              Clear history
            </button>
          </div>

          <div className="flex flex-wrap gap-2" role="region" aria-label="Recent prompts list">
            {recentPrompts.map((promptText, idx) => {
              const isActive = compositionPrompt.trim() === promptText.trim();
              return (
                <div
                  key={`${promptText}-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleApplyRecentPrompt(promptText)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleApplyRecentPrompt(promptText);
                    }
                  }}
                  title={`Click to apply: "${promptText}"`}
                  className={`group max-w-full sm:max-w-[420px] inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-[13px] leading-snug cursor-pointer transition-all select-none ${
                    isActive
                      ? 'bg-[#FFEADA] dark:bg-[#3D2518] border-[#C4633E] dark:border-[#E07A52] text-[#C4633E] dark:text-[#E07A52] font-medium shadow-sm'
                      : 'bg-[#FAF5EE] dark:bg-[#25211D] border-[#E8DEC9] dark:border-[#352D26] text-[#4F4740] dark:text-[#D5CCC3] hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:bg-[#FFFDF9] dark:hover:bg-[#2C2621]'
                  }`}
                >
                  <span className="truncate flex-1 min-w-0" title={promptText}>
                    {promptText}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete prompt: ${promptText}`}
                    title="Delete prompt"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecentPrompt(promptText);
                    }}
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[#A79C92] dark:text-[#7A7066] hover:text-[#C4633E] dark:hover:text-[#F5AB88] hover:bg-[#F2E8DC] dark:hover:bg-[#382D24] transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Select Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-[22px]">
        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459] dark:text-[#D5CCC3]">
          Model
          <select id="model-select" value={model} onChange={(e) => setModel(e.target.value)} className={selectClasses}>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#FCFAF6] dark:bg-[#25211D] text-[#2E2A26] dark:text-[#F5EFEA]">
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459] dark:text-[#D5CCC3]">
          Aspect ratio
          <select
            id="aspect-ratio-select"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className={selectClasses}
          >
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar.value} value={ar.value} className="bg-[#FCFAF6] dark:bg-[#25211D] text-[#2E2A26] dark:text-[#F5EFEA]">
                {ar.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[13.5px] text-[#6E6459] dark:text-[#D5CCC3]">
          Text language
          <select
            id="text-language-select"
            value={textLanguage}
            onChange={(e) => setTextLanguage(e.target.value)}
            className={selectClasses}
          >
            {TEXT_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="bg-[#FCFAF6] dark:bg-[#25211D] text-[#2E2A26] dark:text-[#F5EFEA]">
                {lang.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center mt-6 pt-5 border-t border-[#F0E7DA] dark:border-[#2E2924]">
        <button
          type="button"
          id="open-app-btn"
          onClick={handleOpenApp}
          disabled={isOpeningApp}
          title="Open Image Generation App with prompt parameters"
          className="flex items-center justify-center gap-2 px-[22px] py-3.5 rounded-2xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer shadow-[0_12px_24px_-14px_rgba(196,99,62,0.95)] dark:shadow-none transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {isOpeningApp ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          <span>{isOpeningApp ? 'Opening…' : 'Open image app'}</span>
        </button>

        <button
          type="button"
          id="copy-prompt-btn"
          onClick={handleCopyPrompt}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-[#D6C8B8] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer hover:bg-[#FAF5EE] dark:hover:bg-[#25211D] hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4 text-green-600 dark:text-[#8FA87F]" />
              <span>Copied ✓</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy payload</span>
            </>
          )}
        </button>

        <button
          type="button"
          id="generate-final-prompt-btn"
          onClick={() => {
            if (compositionPrompt?.trim()) {
              addRecentPrompt(compositionPrompt);
            }
            setIsFinalPromptModalOpen(true);
          }}
          title="Generate final prompt and combined reference images based on workflow schema"
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-[#C4633E] dark:border-[#E07A52] bg-[#FFF8F3] dark:bg-[#251D18] text-[#C4633E] dark:text-[#E07A52] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer hover:bg-[#C4633E] hover:text-[#FFF7F1] dark:hover:bg-[#E07A52] dark:hover:text-[#181411] transition-all shadow-sm hover:shadow"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate final prompt</span>
        </button>

        <button
          type="button"
          id="save-as-preset-btn"
          onClick={handleSaveAsPreset}
          title="Save current prompt, cast, style, and settings as a new preset recipe"
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-[#D6C8B8] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[15px] font-medium whitespace-nowrap shrink-0 w-auto cursor-pointer hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52] hover:bg-[#FAF5EE] dark:hover:bg-[#25211D] transition-colors"
        >
          <BookmarkPlus className="w-4 h-4 text-[#C4633E] dark:text-[#E07A52]" />
          <span>Save as preset</span>
        </button>
      </div>

      {appError && (
        <div className="mt-4 text-sm text-[#96402F] dark:text-[#F5AB88] bg-[#FBEAE5] dark:bg-[#2C1C14] border border-[#F1D3C9] dark:border-[#4D2B1C] rounded-xl px-4 py-2.5">
          {appError}
        </div>
      )}

      <FinalPromptModal
        isOpen={isFinalPromptModalOpen}
        onClose={() => setIsFinalPromptModalOpen(false)}
        instruction={compositionPrompt}
        characters={selectedCharacters}
        selectedAddOnsByCharacterId={selectedAddOnsByCharacterId}
        style={selectedStyle}
        aspectRatio={aspectRatio}
        textLanguage={textLanguage}
      />
    </section>
  );
};
