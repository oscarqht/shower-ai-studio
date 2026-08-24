'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Image as ImageIcon, Info, Copy, ArrowUpRight } from 'lucide-react';
import { StylePack } from '../types';

interface StyleSelectorProps {
  styles: StylePack[];
  selectedStyleId: string | number | null;
  onSelectStyle: (styleId: string | number | null) => void;
  isLoading?: boolean;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  styles,
  selectedStyleId,
  onSelectStyle,
  isLoading = false,
}) => {
  const [inspectStyle, setInspectStyle] = useState<StylePack | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyTitle = (title: string) => {
    navigator.clipboard.writeText(title);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  // Sort style pack cards in reverse order
  const reversedStyles = useMemo(() => {
    return [...styles].reverse();
  }, [styles]);

  const styleChosen = selectedStyleId !== null;
  const styleCountLabel = styleChosen ? '1 selected' : `${styles.length} packs`;

  const scrollToCompose = () => {
    const section = document.getElementById('composition-section');
    if (section) {
      const headerOffset = 80;
      const targetPosition = section.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  };

  return (
    <section>
      <div className="flex items-baseline gap-3.5 flex-wrap mb-1.5">
        <span className="font-mono text-[11px] tracking-[0.16em] text-[#C4633E]">STEP 02</span>
        <h2 className="font-serif font-normal text-[26px] sm:text-[34px] text-[#2E2A26]">What should it look like?</h2>
        <span className="font-mono text-[12.5px] text-[#8A7E73]">{styleCountLabel}</span>
      </div>
      <p className="mb-[18px] text-[#8A7E73] text-[15px]">
        One style pack at a time. Peek at the details before you commit.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px] animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-[16/10] bg-[#EFE6DA]/60 rounded-[20px]" />
          ))}
        </div>
      ) : styles.length === 0 ? (
        <div className="border border-dashed border-[#DCCFBF] rounded-[22px] px-6 py-10 text-center">
          <div className="font-serif text-[24px] text-[#2E2A26]">No style packs yet</div>
          <p className="mx-auto mt-2 max-w-[44ch] text-[#8A7E73] text-[14.5px] leading-[1.55]">
            Save style packs to your Raindrop collection and re-sync to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px]">
          {reversedStyles.map((style) => {
            const isSelected = selectedStyleId === style.id;

            return (
              <div
                key={style.id}
                onClick={() => onSelectStyle(isSelected ? null : style.id)}
                className={`rounded-[20px] p-2 cursor-pointer transition-transform hover:-translate-y-0.5 ${
                  isSelected
                    ? 'bg-[#FFF3EA] border-[1.5px] border-[#C4633E] shadow-[0_14px_28px_-20px_rgba(196,99,62,0.9)]'
                    : 'bg-[#FFFDFA] border-[1.5px] border-[#EFE6DA]'
                }`}
              >
                <div className="relative aspect-[16/10] rounded-[14px] overflow-hidden bg-[#EFE6DA]">
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
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#A08F80]">
                      <ImageIcon className="w-7 h-7 mb-1.5 opacity-50" />
                      <span className="text-xs">No preview</span>
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[#C4633E] text-[#FFF7F1]">
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
                    className="absolute bottom-2 right-2 p-1.5 rounded-full border border-[#E3D8CA] bg-[rgba(255,253,250,0.92)] text-[#6E6459] flex items-center justify-center hover:bg-[#F8F3ED] transition-colors"
                  >
                    <Info className="w-[18px] h-[18px]" />
                  </button>
                </div>

                <div className="px-1.5 pt-2.5 pb-1.5 flex flex-col gap-1.5">
                  <div className="text-[16px] font-medium text-[#2E2A26] truncate" title={style.title}>
                    {style.title}
                  </div>
                  {style.style_prompt && (
                    <p className="text-[13px] text-[#8A7E73] leading-[1.5] line-clamp-2">{style.style_prompt}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        {selectedStyleId !== null && (
          <button
            onClick={() => onSelectStyle(null)}
            className="px-3.5 py-1.5 rounded-full border border-[#E3D8CA] bg-transparent text-[#8A7E73] text-[13.5px]"
          >
            Clear style
          </button>
        )}
        {styleChosen && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF1E6] text-[#5C6B50] text-[13.5px] animate-rise">
            <span>Style locked in — step 3 is ready</span>
            <button
              onClick={scrollToCompose}
              className="border-none bg-transparent text-[#3F6B2F] font-medium underline underline-offset-2"
            >
              Compose ↓
            </button>
          </div>
        )}
      </div>

      {/* Style Inspection Modal */}
      {inspectStyle && mounted &&
        createPortal(
          <div
            onClick={() => setInspectStyle(null)}
            className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] backdrop-blur-sm flex items-end sm:items-center justify-center"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDFA] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
            >
              <div className="flex items-start gap-3.5 mb-1.5">
                <h3 className="font-serif text-[27px] text-[#2E2A26] flex-1">{inspectStyle.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyTitle(inspectStyle.title)}
                    title="Copy style pack name"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center hover:bg-[#EAE1D3] transition-colors"
                  >
                    {copiedTitle ? <Check className="w-4 h-4 text-[#3F6B2F]" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://app.raindrop.io/my/${inspectStyle.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Raindrop.io"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center hover:bg-[#EAE1D3] transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setInspectStyle(null)}
                    title="Close"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center hover:bg-[#EAE1D3] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="mb-[18px] text-[#8A7E73] text-[14.5px] leading-[1.55]">
                Browsing here never changes your current selection.
              </p>

              <div className="flex flex-col gap-4">
                {inspectStyle.preview_cover && (
                  <div className="rounded-2xl overflow-hidden bg-[#EFE6DA] max-h-56">
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
                    <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">
                      Reference images
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {inspectStyle.style_reference_links.map((link, idx) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-[#EFE6DA]">
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

                <div className="rounded-2xl bg-[#FAF5EE] px-4 py-3.5">
                  <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">
                    Style prompt
                  </div>
                  <div className="text-[14.5px] leading-[1.6] text-[#4F4740] whitespace-pre-wrap">
                    {inspectStyle.style_prompt || 'No style prompt defined.'}
                  </div>
                </div>

                {inspectStyle.extra_style_instruction && (
                  <div className="rounded-2xl bg-[#FAF5EE] px-4 py-3.5">
                    <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] mb-2">
                      Extra instructions
                    </div>
                    <div className="text-[14.5px] leading-[1.6] text-[#4F4740]">
                      {inspectStyle.extra_style_instruction}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    onSelectStyle(inspectStyle.id);
                    setInspectStyle(null);
                  }}
                  className="self-start flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] cursor-pointer"
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
