'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Image as ImageIcon,
  Info,
  Copy,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { StylePack } from '../types';

export const MORE_STYLES_CACHE_STORAGE_KEY = 'shower_studio_more_styles_cache_v1';

interface MoreStyleSelectorProps {
  selectedStyleId: string | number | null;
  onSelectStyle: (styleId: string | number | null) => void;
  raindropToken?: string;
  hasRaindropToken: boolean;
  onStylesLoaded?: (styles: StylePack[]) => void;
}

export const MoreStyleSelector: React.FC<MoreStyleSelectorProps> = ({
  selectedStyleId,
  onSelectStyle,
  raindropToken,
  hasRaindropToken,
  onStylesLoaded,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [styles, setStyles] = useState<StylePack[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(MORE_STYLES_CACHE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.styles)) {
          return parsed.styles;
        }
      }
    } catch (e) {
      console.error('Failed to load more styles cache from localStorage:', e);
    }
    return [];
  });

  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const cached = localStorage.getItem(MORE_STYLES_CACHE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Boolean(parsed.hasFetchedOnce);
      }
    } catch {}
    return false;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inspectStyle, setInspectStyle] = useState<StylePack | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Inform parent of current more styles so it can resolve selectedStyle & presets
  useEffect(() => {
    if (styles.length > 0 && onStylesLoaded) {
      onStylesLoaded(styles);
    }
  }, [styles, onStylesLoaded]);

  const handleCopyTitle = (title: string) => {
    navigator.clipboard.writeText(title);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const fetchMoreStyles = async (force: boolean = false) => {
    if (!hasRaindropToken) {
      setErrorMessage('Please connect Raindrop or configure an API token in Settings first.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/raindrop/more-styles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(raindropToken && raindropToken.trim()
            ? { Authorization: `Bearer ${raindropToken.trim()}` }
            : {}),
        },
        body: JSON.stringify({
          token: raindropToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'Failed to fetch more styles from Raindrop');
      }

      const fetchedStyles: StylePack[] = data.styles || [];
      setStyles(fetchedStyles);
      setHasFetchedOnce(true);

      // Save to localStorage without expiration
      try {
        localStorage.setItem(
          MORE_STYLES_CACHE_STORAGE_KEY,
          JSON.stringify({
            styles: fetchedStyles,
            hasFetchedOnce: true,
            savedAt: Date.now(),
          })
        );
      } catch (e) {
        console.error('Failed to save more styles cache to localStorage:', e);
      }

      if (onStylesLoaded) {
        onStylesLoaded(fetchedStyles);
      }
    } catch (err: any) {
      console.error('Error fetching more styles:', err);
      setErrorMessage(err.message || 'Failed to load more style packs');
    } finally {
      setIsLoading(false);
    }
  };

  // When expanding: only fetch once if not previously fetched/cached
  const handleToggleExpand = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);

    if (nextState && !hasFetchedOnce && styles.length === 0 && !isLoading) {
      fetchMoreStyles(false);
    }
  };

  const handleManualReload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      setIsExpanded(true);
    }
    fetchMoreStyles(true);
  };

  const reversedStyles = useMemo(() => {
    return [...styles].reverse();
  }, [styles]);

  return (
    <section className="rounded-[24px] border border-[#EAE0D4] dark:border-[#2E2924] bg-[#FFFDFA] dark:bg-[#1C1916] overflow-hidden transition-all duration-300 shadow-[0_4px_20px_-10px_rgba(88,66,48,0.06)] dark:shadow-none">
      {/* Header Bar / Toggle */}
      <div
        onClick={handleToggleExpand}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer select-none hover:bg-[#FAF5EE]/60 dark:hover:bg-[#25211D]/60 transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-[#FAF5EE] dark:bg-[#25211D] border border-[#E6DCCF] dark:border-[#332C26] text-[#7A6F64] dark:text-[#A69B90] flex items-center justify-center shrink-0 transition-transform duration-200"
            aria-label={isExpanded ? 'Collapse more style packs' : 'Expand more style packs'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#C4633E] dark:text-[#E07A52]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#8A7E73] dark:text-[#A69B90]" />
            )}
          </button>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 truncate">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#C4633E] dark:text-[#E07A52] bg-[#F7E7DC] dark:bg-[#2C1C14] px-2 py-0.5 rounded-md font-medium">
                Extra
              </span>
              <h3 className="font-serif font-normal text-[20px] sm:text-[23px] text-[#2E2A26] dark:text-[#F5EFEA] truncate">
                More style packs
              </h3>
            </div>
            <span className="text-xs sm:text-[13px] text-[#8A7E73] dark:text-[#A69B90] truncate">
              {hasFetchedOnce
                ? `${styles.length} ${styles.length === 1 ? 'pack' : 'packs'} cached from Shower > More styles`
                : 'Archived & secondary style packs in Raindrop'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Reload Button */}
          <button
            type="button"
            onClick={handleManualReload}
            disabled={isLoading}
            title="Reload more style packs from Raindrop"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#25211D] hover:bg-[#F4EDE3] dark:hover:bg-[#2E2924] text-[#6E6459] dark:text-[#D5CCC3] text-[12.5px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#C4633E] dark:text-[#E07A52]' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? 'Fetching…' : 'Reload'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="px-5 sm:px-6 pt-1 pb-6 border-t border-[#F2E9DE] dark:border-[#2E2924] bg-[#FFFDFC] dark:bg-[#181512]">
          <div className="flex items-center justify-between gap-3 mb-4 mt-3 flex-wrap">
            <p className="text-[#8A7E73] dark:text-[#A69B90] text-[14px]">
              Styles loaded from your Raindrop collection <span className="font-mono text-[12px] text-[#5B5148] dark:text-[#D5CCC3] bg-[#F4EDE3] dark:bg-[#25211D] px-2 py-0.5 rounded">Shower / More styles</span>.
            </p>
            {hasFetchedOnce && (
              <span className="font-mono text-[11.5px] text-[#7C8F6F] dark:text-[#8FA87F] bg-[#EDF1E6] dark:bg-[#1E281C] px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5C6B50] dark:bg-[#8FA87F]" />
                Cached locally
              </span>
            )}
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px] animate-pulse py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="aspect-[16/10] bg-[#EFE6DA]/60 dark:bg-[#25211D] rounded-[20px]" />
              ))}
            </div>
          ) : errorMessage ? (
            /* Error State */
            <div className="rounded-[18px] border border-[#F1D3C9] dark:border-[#4D2B1C] bg-[#FBEAE5] dark:bg-[#2C1C14] p-5 text-center my-2">
              <div className="flex items-center justify-center gap-2 text-[#96402F] dark:text-[#F5AB88] font-medium text-[15px] mb-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Could not load more style packs</span>
              </div>
              <p className="text-[13.5px] text-[#96402F]/90 dark:text-[#F5AB88]/90 max-w-md mx-auto mb-4">{errorMessage}</p>
              <button
                type="button"
                onClick={() => fetchMoreStyles(true)}
                className="px-4 py-2 rounded-xl bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[13.5px] font-medium hover:bg-[#B35633] transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : styles.length === 0 ? (
            /* Empty State */
            <div className="border border-dashed border-[#DCCFBF] dark:border-[#3D352E] rounded-[20px] px-6 py-8 text-center bg-[#FAF5EE]/40 dark:bg-[#1C1916]/40 my-2">
              <div className="w-10 h-10 rounded-full bg-[#EFE6DA] dark:bg-[#25211D] text-[#8A7E73] dark:text-[#A69B90] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5 opacity-70 text-[#C4633E] dark:text-[#E07A52]" />
              </div>
              <div className="font-serif text-[20px] text-[#2E2A26] dark:text-[#F5EFEA]">No extra style packs found</div>
              <p className="mx-auto mt-2 max-w-[48ch] text-[#8A7E73] dark:text-[#A69B90] text-[14px] leading-[1.55]">
                To see packs here, create a child collection named <strong className="text-[#5B5148] dark:text-[#D5CCC3] font-mono font-normal">More styles</strong> under your <strong className="text-[#5B5148] dark:text-[#D5CCC3] font-mono font-normal">Shower</strong> collection in Raindrop, then click reload.
              </p>
              <button
                type="button"
                onClick={() => fetchMoreStyles(true)}
                className="mt-4 px-4 py-2 rounded-xl border border-[#D6C8B8] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#25211D] text-[#5B5148] dark:text-[#D5CCC3] text-[13.5px] font-medium hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52] transition-colors cursor-pointer"
              >
                Check Raindrop Again
              </button>
            </div>
          ) : (
            /* Styles Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px]">
              {reversedStyles.map((style) => {
                const isSelected = selectedStyleId === style.id;

                return (
                  <div
                    key={style.id}
                    onClick={() => onSelectStyle(isSelected ? null : style.id)}
                    className={`rounded-[20px] p-2 cursor-pointer transition-transform hover:-translate-y-0.5 ${
                      isSelected
                        ? 'bg-[#FFF3EA] dark:bg-[#2C1C14] border-[1.5px] border-[#C4633E] dark:border-[#E07A52] shadow-[0_14px_28px_-20px_rgba(196,99,62,0.9)] dark:shadow-none'
                        : 'bg-[#FFFDFA] dark:bg-[#1C1916] border-[1.5px] border-[#EFE6DA] dark:border-[#2E2924]'
                    }`}
                  >
                    <div className="relative aspect-[16/10] rounded-[14px] overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D]">
                      {style.preview_cover ? (
                        <img
                          src={style.preview_cover}
                          alt={style.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#A08F80] dark:text-[#7A7066]">
                          <ImageIcon className="w-7 h-7 mb-1.5 opacity-50" />
                          <span className="text-xs">No preview</span>
                        </div>
                      )}

                      {isSelected && (
                        <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411]">
                          Selected
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectStyle(style);
                        }}
                        title="View style details"
                        className="absolute bottom-2 right-2 p-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[rgba(255,253,250,0.92)] dark:bg-[rgba(28,25,22,0.92)] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#F8F3ED] dark:hover:bg-[#2A2520] transition-colors"
                      >
                        <Info className="w-[18px] h-[18px]" />
                      </button>
                    </div>

                    <div className="px-1.5 pt-2.5 pb-1.5 flex flex-col gap-1.5">
                      <div className="text-[16px] font-medium text-[#2E2A26] dark:text-[#F5EFEA] truncate" title={style.title}>
                        {style.title}
                      </div>
                      {style.style_prompt && (
                        <p className="text-[13px] text-[#8A7E73] dark:text-[#A69B90] leading-[1.5] line-clamp-2">
                          {style.style_prompt}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Style Inspection Modal */}
      {inspectStyle && mounted &&
        createPortal(
          <div
            onClick={() => setInspectStyle(null)}
            className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-[rgba(0,0,0,0.65)] backdrop-blur-sm flex items-end sm:items-center justify-center"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDFA] dark:bg-[#1C1916] border border-transparent dark:border-[#2E2924] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
            >
              <div className="flex items-start gap-3.5 mb-1.5">
                <h3 className="font-serif text-[27px] text-[#2E2A26] dark:text-[#F5EFEA] flex-1">{inspectStyle.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyTitle(inspectStyle.title)}
                    title="Copy style pack name"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors cursor-pointer"
                  >
                    {copiedTitle ? <Check className="w-4 h-4 text-[#3F6B2F] dark:text-[#8FA87F]" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://app.raindrop.io/my/${inspectStyle.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Raindrop.io"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setInspectStyle(null)}
                    title="Close"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="mb-[18px] text-[#8A7E73] dark:text-[#A69B90] text-[14.5px] leading-[1.55]">
                Browsing here never changes your current selection.
              </p>

              <div className="flex flex-col gap-4">
                {inspectStyle.preview_cover && (
                  <div className="rounded-2xl overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D] max-h-56">
                    <img
                      src={inspectStyle.preview_cover}
                      alt={inspectStyle.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {inspectStyle.style_reference_links && inspectStyle.style_reference_links.length > 0 && (
                  <div>
                    <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2">
                      Reference images
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {inspectStyle.style_reference_links.map((link, idx) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D]">
                          <img
                            src={link}
                            alt={`Reference ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3.5">
                  <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2">
                    Style prompt
                  </div>
                  <div className="text-[14.5px] leading-[1.6] text-[#4F4740] dark:text-[#D5CCC3] whitespace-pre-wrap">
                    {inspectStyle.style_prompt || 'No style prompt defined.'}
                  </div>
                </div>

                {inspectStyle.extra_style_instruction && (
                  <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3.5">
                    <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-2">
                      Extra instructions
                    </div>
                    <div className="text-[14.5px] leading-[1.6] text-[#4F4740] dark:text-[#D5CCC3]">
                      {inspectStyle.extra_style_instruction}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    onSelectStyle(inspectStyle.id);
                    setInspectStyle(null);
                  }}
                  className="self-start flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer"
                >
                  {selectedStyleId === inspectStyle.id ? (
                    <>
                      <Check className="w-4 h-4" /> Already selected
                    </>
                  ) : (
                    'Use this style'
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
