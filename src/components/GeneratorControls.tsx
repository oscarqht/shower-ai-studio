'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Copy, ExternalLink } from 'lucide-react';
import { Character, StylePack } from '../types';

interface GeneratorControlsProps {
  selectedCharacters: Character[];
  selectedStyle: StylePack | null;
  imageAppUrl?: string;
  raindropToken?: string;
  onResetAll?: () => void;
  hasUploadCapability?: boolean;
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
  'w-full px-3.5 py-3 rounded-xl border border-[#E3D8CA] bg-[#FCFAF6] text-[14.5px] text-[#2E2A26] cursor-pointer outline-none focus:border-[#C4633E]';

export const GeneratorControls: React.FC<GeneratorControlsProps> = ({
  selectedCharacters,
  selectedStyle,
  imageAppUrl,
  raindropToken,
  onResetAll,
  hasUploadCapability,
}) => {
  const saved = getSavedControls();
  const [model, setModel] = useState<string>(saved.model || 'GPT Image 2');
  const [compositionPrompt, setCompositionPrompt] = useState<string>(saved.compositionPrompt || '');
  const [aspectRatio, setAspectRatio] = useState<string>(saved.aspectRatio || 'Auto');
  const [textLanguage, setTextLanguage] = useState<string>(saved.textLanguage || 'Auto');
  const [isCopied, setIsCopied] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isStyleCopied, setIsStyleCopied] = useState(false);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileThumbnails, setFileThumbnails] = useState<{ id: string; url: string; name: string }[]>([]);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      fileThumbnails.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, []);

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
    setUploadedFileIds([]);
    setUploadError(null);
    fileThumbnails.forEach((t) => URL.revokeObjectURL(t.url));
    setFileThumbnails([]);
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
        
        let finalUrl = `${baseUrl}${delimiter}instruction=${encodeURIComponent(compositionPrompt)}&json=${encodeURIComponent(jsonString)}`;

        if (uploadedFileIds && uploadedFileIds.length > 0) {
          finalUrl += `&attachment_file_ids=${encodeURIComponent(uploadedFileIds.join(','))}`;
        }
        
        finalUrl += `&_auto_=1`;

        window.open(finalUrl, '_blank');
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!raindropToken || !raindropToken.trim()) {
      setUploadError('No valid connection — add a token in settings to upload attachments.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('token', raindropToken);
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/upload-attachments', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.status === 'success' && data.file_ids) {
        // Generate thumbnails
        const newThumbnails = Array.from(files).map((file, idx) => ({
          id: data.file_ids[idx],
          url: URL.createObjectURL(file),
          name: file.name,
        }));

        setFileThumbnails(prev => [...prev, ...newThumbnails]);
        setUploadedFileIds(prev => [...prev, ...data.file_ids]);
      } else {
        setUploadError(data?.message || 'Failed to upload attachments.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(`Failed to upload: ${err.message || 'Network error'}`);
    } finally {
      setIsUploading(false);
      // Clear input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (idToRemove: string) => {
    setUploadedFileIds(prev => prev.filter(id => id !== idToRemove));
    setFileThumbnails(prev => {
      const itemToRemove = prev.find(t => t.id === idToRemove);
      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.url);
      }
      return prev.filter(t => t.id !== idToRemove);
    });
  };

  const handleClearAttachments = () => {
    fileThumbnails.forEach(t => URL.revokeObjectURL(t.url));
    setFileThumbnails([]);
    setUploadedFileIds([]);
    setUploadError(null);
  };

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
        <div className="rounded-2xl bg-[#FAF5EE] px-4 py-3.5 relative flex flex-col justify-center group">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">Style</div>
          <div className="flex items-center justify-between gap-2">
            <div className={`text-[14.5px] leading-[1.5] ${selectedStyle ? 'text-[#4F4740]' : 'text-[#A79C92]'}`}>
              {styleSummary}
            </div>
            {selectedStyle && (
              <button
                type="button"
                onClick={handleCopyStyle}
                title="Copy style name"
                className="p-1.5 rounded-lg border border-[#EBE1D4] bg-[#FFFDFA] text-[#8A7E73] hover:text-[#2E2A26] hover:bg-[#F6F0E7] transition-colors"
              >
                {isStyleCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
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

      {/* Upload Attachments */}
      {hasUploadCapability && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-[#2E2A26]">
              Upload attachments
            </label>
            {uploadedFileIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAttachments}
                className="text-[12.5px] text-[#8A7E73] hover:text-[#2E2A26] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-[#6E6459] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#F6F0E7] file:text-[#4F4740] hover:file:bg-[#EAE0D4] transition-colors cursor-pointer disabled:opacity-50"
            />
            {isUploading && (
              <div className="text-[13px] text-[#C4633E] flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Uploading...
              </div>
            )}
            {uploadError && (
              <div className="text-[13px] text-[#96402F]">
                {uploadError}
              </div>
            )}
            {!isUploading && !uploadError && uploadedFileIds.length > 0 && (
              <div className="text-[13px] text-[#4F4740] flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-600" />
                <span>{uploadedFileIds.length} file{uploadedFileIds.length > 1 ? 's' : ''} uploaded successfully</span>
              </div>
            )}

            {fileThumbnails.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {fileThumbnails.map((thumb) => (
                  <div key={thumb.id} className="relative w-16 h-16 rounded-lg border border-[#E3D8CA] bg-[#FAF5EE] group">
                    <img
                      src={thumb.url}
                      alt={thumb.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(thumb.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-white rounded-full border border-[#E3D8CA] shadow-sm text-[#8A7E73] hover:text-[#96402F] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
          <span>{isOpeningApp ? 'Opening…' : 'Open image app'}</span>
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
