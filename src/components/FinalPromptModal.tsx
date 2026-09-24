import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Sparkles,
  Users,
  Palette,
  Paperclip,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import { Character, StylePack } from '@/types';
import { buildFinalPrompt } from '@/lib/buildFinalPrompt';
import {
  combineImages,
  CombinedImageResult,
  copyImageToClipboard,
  downloadImage,
  ImageItem,
} from '@/lib/imageCombiner';

interface FinalPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  instruction: string;
  characters: Character[];
  selectedAddOnsByCharacterId?: Record<string, string[]>;
  style: StylePack | null;
  uploadedFiles?: { id: string; url: string; name: string }[];
  aspectRatio: string;
  textLanguage: string;
}

export const FinalPromptModal: React.FC<FinalPromptModalProps> = ({
  isOpen,
  onClose,
  instruction,
  characters,
  selectedAddOnsByCharacterId = {},
  style,
  uploadedFiles = [],
  aspectRatio,
  textLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'prompt' | 'images'>('all');
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [characterCombined, setCharacterCombined] = useState<CombinedImageResult | null>(null);
  const [styleCombined, setStyleCombined] = useState<CombinedImageResult | null>(null);
  const [attachmentsCombined, setAttachmentsCombined] = useState<CombinedImageResult | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewEnlargedUrl, setPreviewEnlargedUrl] = useState<string | null>(null);

  // Filter valid character reference items
  const validCharItems: ImageItem[] = React.useMemo(() => {
    return characters
      .filter((c) => c && c.cover && c.cover.trim())
      .map((c) => ({
        url: c.cover.trim(),
        label: c.title || 'Character',
      }));
  }, [characters]);

  // Filter valid style reference items
  const validStyleItems: ImageItem[] = React.useMemo(() => {
    if (!style) return [];
    const items: ImageItem[] = [];
    if (style.style_reference_links && style.style_reference_links.length > 0) {
      style.style_reference_links.forEach((url, i) => {
        if (url && url.trim()) {
          items.push({ url: url.trim(), label: `Ref ${i + 1}` });
        }
      });
    } else if (style.preview_cover && style.preview_cover.trim()) {
      items.push({ url: style.preview_cover.trim(), label: style.title || 'Style Preview' });
    }
    return items;
  }, [style]);

  // Filter valid attachments
  const validAttachmentItems: ImageItem[] = React.useMemo(() => {
    return uploadedFiles
      .filter((f) => f && f.url && f.url.trim())
      .map((f, i) => ({
        url: f.url.trim(),
        label: f.name || `Attachment ${i + 1}`,
      }));
  }, [uploadedFiles]);

  // Build the prompt text dynamically
  const generatedPrompt = buildFinalPrompt({
    instruction,
    characters,
    selectedAddOnsByCharacterId,
    hasCharacterReferenceImage: validCharItems.length > 0,
    style,
    hasStyleReferenceImage: validStyleItems.length > 0,
    hasAttachments: validAttachmentItems.length > 0,
    aspectRatio,
    textLanguage,
  });

  // When modal opens, combine images
  useEffect(() => {
    if (!isOpen) {
      setCharacterCombined(null);
      setStyleCombined(null);
      setAttachmentsCombined(null);
      return;
    }

    let isCancelled = false;

    const processImages = async () => {
      setIsCombining(true);
      try {
        const [charResult, styleResult, attachResult] = await Promise.all([
          validCharItems.length > 0
            ? combineImages(validCharItems, { showLabels: true })
            : Promise.resolve(null),
          validStyleItems.length > 0
            ? combineImages(validStyleItems, { showLabels: false })
            : Promise.resolve(null),
          validAttachmentItems.length > 0
            ? combineImages(validAttachmentItems, { showLabels: false })
            : Promise.resolve(null),
        ]);

        if (!isCancelled) {
          setCharacterCombined(charResult);
          setStyleCombined(styleResult);
          setAttachmentsCombined(attachResult);
        }
      } catch (err) {
        console.error('Failed to combine images:', err);
      } finally {
        if (!isCancelled) {
          setIsCombining(false);
        }
      }
    };

    processImages();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, validCharItems, validStyleItems, validAttachmentItems]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewEnlargedUrl) {
          setPreviewEnlargedUrl(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewEnlargedUrl, onClose]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setIsPromptCopied(true);
      setTimeout(() => setIsPromptCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy prompt:', e);
    }
  };

  const handleCopyImage = async (blob: Blob, key: string) => {
    const success = await copyImageToClipboard(blob);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      // Fallback: download directly if browser denies clipboard write for image
      downloadImage(blob, `${key}.png`);
      setCopiedKey(`${key}-downloaded`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownloadImage = (blob: Blob, filename: string) => {
    downloadImage(blob, filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#FCFAF6] dark:bg-[#1E1B18] text-[#2E2A26] dark:text-[#F5EFEA] rounded-3xl shadow-2xl border border-[#E8DFC8] dark:border-[#38322B] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#EFE8DC] dark:border-[#2C2723] bg-[#F7F2E9]/60 dark:bg-[#25211D]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C4633E]/10 dark:bg-[#E07A52]/15 text-[#C4633E] dark:text-[#E07A52] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[#2E2A26] dark:text-[#F5EFEA]">
                Final Image Prompt & References
              </h2>
              <p className="text-xs text-[#7A7066] dark:text-[#A79C92]">
                Compiled based on workflow schema — ready to copy into any AI generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View filter tabs */}
            <div className="hidden sm:flex items-center gap-1 bg-[#ECE4D5] dark:bg-[#2A2520] p-1 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-[#FFFDFA] dark:bg-[#1A1714] text-[#2E2A26] dark:text-[#F5EFEA] shadow-sm'
                    : 'text-[#7A7066] dark:text-[#A79C92] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('prompt')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'prompt'
                    ? 'bg-[#FFFDFA] dark:bg-[#1A1714] text-[#2E2A26] dark:text-[#F5EFEA] shadow-sm'
                    : 'text-[#7A7066] dark:text-[#A79C92] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA]'
                }`}
              >
                Prompt Only
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('images')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'images'
                    ? 'bg-[#FFFDFA] dark:bg-[#1A1714] text-[#2E2A26] dark:text-[#F5EFEA] shadow-sm'
                    : 'text-[#7A7066] dark:text-[#A79C92] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA]'
                }`}
              >
                Images Only
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#7A7066] dark:text-[#A79C92] hover:bg-[#EFE8DC] dark:hover:bg-[#2F2923] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA] transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Copy Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F4EFE6] dark:bg-[#25211D] border border-[#E8DFC8] dark:border-[#38322B]">
            <div className="flex items-center gap-2.5 text-sm text-[#5B5148] dark:text-[#D5CCC3]">
              <span className="w-2 h-2 rounded-full bg-[#C4633E] dark:bg-[#E07A52] animate-pulse" />
              <span>
                <strong>Tip:</strong> Copy the prompt text, then click <strong>Copy Image</strong> on the reference cards to paste directly into your generator.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-sm font-medium shadow hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            >
              {isPromptCopied ? (
                <>
                  <Check className="w-4 h-4 text-white dark:text-[#181411]" />
                  <span>Prompt Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Prompt Column */}
            {(activeTab === 'all' || activeTab === 'prompt') && (
              <div
                className={`${
                  activeTab === 'prompt' ? 'lg:col-span-12' : 'lg:col-span-7'
                } flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[#2E2A26] dark:text-[#F5EFEA]">
                    <Sparkles className="w-4 h-4 text-[#C4633E] dark:text-[#E07A52]" />
                    <span>Compiled Schema Prompt</span>
                  </div>
                  <span className="text-xs text-[#7A7066] dark:text-[#A79C92]">
                    {generatedPrompt.length} characters
                  </span>
                </div>

                <div className="relative rounded-2xl border border-[#E2D6C3] dark:border-[#352F29] bg-[#FFFDFA] dark:bg-[#161412] p-4 text-[#2E2A26] dark:text-[#EDE5DC] text-[13.5px] leading-relaxed font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto select-all shadow-inner">
                  {generatedPrompt}
                </div>
              </div>
            )}

            {/* Combined Reference Images Column */}
            {(activeTab === 'all' || activeTab === 'images') && (
              <div
                className={`${
                  activeTab === 'images' ? 'lg:col-span-12' : 'lg:col-span-5'
                } flex flex-col gap-5`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[#2E2A26] dark:text-[#F5EFEA]">
                    <Palette className="w-4 h-4 text-[#C4633E] dark:text-[#E07A52]" />
                    <span>Combined Reference Images</span>
                  </div>
                  {isCombining && (
                    <span className="flex items-center gap-1.5 text-xs text-[#C4633E] dark:text-[#E07A52]">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Stitching...
                    </span>
                  )}
                </div>

                {/* 1. Character Reference Card */}
                {validCharItems.length > 0 && (
                  <div className="rounded-2xl border border-[#E2D6C3] dark:border-[#352F29] bg-[#FFFDFA] dark:bg-[#1A1714] p-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7A7066] dark:text-[#A79C92]">
                        <Users className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
                        <span>Character References ({validCharItems.length})</span>
                      </div>
                      {characterCombined && (
                        <span className="text-[11px] text-[#A79C92]">
                          {characterCombined.width} × {characterCombined.height}
                        </span>
                      )}
                    </div>

                    {characterCombined ? (
                      <div className="relative group rounded-xl overflow-hidden bg-[#161412] border border-[#2E2924] aspect-video flex items-center justify-center">
                        <img
                          src={characterCombined.dataUrl}
                          alt="Combined character reference"
                          className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                          onClick={() => setPreviewEnlargedUrl(characterCombined.dataUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewEnlargedUrl(characterCombined.dataUrl)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          title="Enlarge image"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl bg-[#F0E8DC] dark:bg-[#25211D] flex items-center justify-center text-xs text-[#7A7066] dark:text-[#A79C92]">
                        {isCombining ? 'Generating composite...' : 'No image preview available'}
                      </div>
                    )}

                    {characterCombined && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyImage(characterCombined.blob, 'character-reference')
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                        >
                          {copiedKey === 'character-reference' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Copied PNG!</span>
                            </>
                          ) : copiedKey === 'character-reference-downloaded' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Downloaded!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Image</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadImage(
                              characterCombined.blob,
                              'character-references.png'
                            )
                          }
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                          title="Download PNG"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Style Reference Card */}
                {validStyleItems.length > 0 && (
                  <div className="rounded-2xl border border-[#E2D6C3] dark:border-[#352F29] bg-[#FFFDFA] dark:bg-[#1A1714] p-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7A7066] dark:text-[#A79C92]">
                        <Palette className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
                        <span>
                          Style References ({validStyleItems.length})
                          {style?.title && ` · ${style.title}`}
                        </span>
                      </div>
                      {styleCombined && (
                        <span className="text-[11px] text-[#A79C92]">
                          {styleCombined.width} × {styleCombined.height}
                        </span>
                      )}
                    </div>

                    {styleCombined ? (
                      <div className="relative group rounded-xl overflow-hidden bg-[#161412] border border-[#2E2924] aspect-video flex items-center justify-center">
                        <img
                          src={styleCombined.dataUrl}
                          alt="Combined style reference"
                          className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                          onClick={() => setPreviewEnlargedUrl(styleCombined.dataUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewEnlargedUrl(styleCombined.dataUrl)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          title="Enlarge image"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl bg-[#F0E8DC] dark:bg-[#25211D] flex items-center justify-center text-xs text-[#7A7066] dark:text-[#A79C92]">
                        {isCombining ? 'Generating composite...' : 'No image preview available'}
                      </div>
                    )}

                    {styleCombined && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyImage(styleCombined.blob, 'style-reference')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                        >
                          {copiedKey === 'style-reference' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Copied PNG!</span>
                            </>
                          ) : copiedKey === 'style-reference-downloaded' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Downloaded!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Image</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadImage(
                              styleCombined.blob,
                              `${(style?.title || 'style').toLowerCase().replace(/\s+/g, '-')}-references.png`
                            )
                          }
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                          title="Download PNG"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Attachments Card */}
                {validAttachmentItems.length > 0 && (
                  <div className="rounded-2xl border border-[#E2D6C3] dark:border-[#352F29] bg-[#FFFDFA] dark:bg-[#1A1714] p-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7A7066] dark:text-[#A79C92]">
                        <Paperclip className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
                        <span>Composition Attachments ({validAttachmentItems.length})</span>
                      </div>
                    </div>

                    {attachmentsCombined ? (
                      <div className="relative group rounded-xl overflow-hidden bg-[#161412] border border-[#2E2924] aspect-video flex items-center justify-center">
                        <img
                          src={attachmentsCombined.dataUrl}
                          alt="Combined attachments"
                          className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                          onClick={() => setPreviewEnlargedUrl(attachmentsCombined.dataUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewEnlargedUrl(attachmentsCombined.dataUrl)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          title="Enlarge image"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl bg-[#F0E8DC] dark:bg-[#25211D] flex items-center justify-center text-xs text-[#7A7066] dark:text-[#A79C92]">
                        {isCombining ? 'Generating composite...' : 'No image preview available'}
                      </div>
                    )}

                    {attachmentsCombined && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyImage(attachmentsCombined.blob, 'attachments-reference')
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                        >
                          {copiedKey === 'attachments-reference' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Copied PNG!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Image</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadImage(
                              attachmentsCombined.blob,
                              'attachments-reference.png'
                            )
                          }
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FAF5EE] dark:bg-[#26211D] border border-[#D6C8B8] dark:border-[#3D352E] text-[#2E2A26] dark:text-[#F5EFEA] text-xs font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {validCharItems.length === 0 &&
                  validStyleItems.length === 0 &&
                  validAttachmentItems.length === 0 && (
                    <div className="p-6 rounded-2xl border border-dashed border-[#D6C8B8] dark:border-[#3D352E] text-center text-xs text-[#7A7066] dark:text-[#A79C92]">
                      No character or style reference images are currently selected.
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#EFE8DC] dark:border-[#2C2723] bg-[#F7F2E9]/60 dark:bg-[#25211D]/60 shrink-0">
          <div className="text-xs text-[#7A7066] dark:text-[#A79C92]">
            Ratio: <strong>{aspectRatio || 'Auto'}</strong> · Language: <strong>{textLanguage || 'Auto'}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[#D6C8B8] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-sm font-medium hover:bg-[#FAF5EE] dark:hover:bg-[#25211D] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom modal */}
      {previewEnlargedUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewEnlargedUrl(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={previewEnlargedUrl}
              alt="Enlarged reference"
              className="max-w-[94vw] max-h-[92vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewEnlargedUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
