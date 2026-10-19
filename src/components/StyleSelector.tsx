'use client';

import React, { useState, useMemo } from 'react';
import { StyleDetailsModal } from './StyleDetailsModal';
import { Image as ImageIcon, Info } from 'lucide-react';
import { StylePack, SaveStyle } from '../types';

interface StyleSelectorProps {
  styles: StylePack[];
  onSaveStyle: SaveStyle;
  selectedStyleId: string | number | null;
  onSelectStyle: (styleId: string | number | null) => void;
  isLoading?: boolean;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  styles,
  onSaveStyle,
  selectedStyleId,
  onSelectStyle,
  isLoading = false,
}) => {
  const [inspectStyle, setInspectStyle] = useState<StylePack | null>(null);

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
        <h2 className="font-serif font-normal text-[26px] sm:text-[34px] text-[#2E2A26] dark:text-[#F5EFEA]">What should it look like?</h2>
        <span className="font-mono text-[12.5px] text-[#8A7E73] dark:text-[#A69B90]">{styleCountLabel}</span>
      </div>
      <p className="mb-[18px] text-[#8A7E73] dark:text-[#A69B90] text-[15px]">
        One style pack at a time. Peek at the details before you commit.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px] animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-[16/10] bg-[#EFE6DA]/60 dark:bg-[#2A2520]/60 rounded-[20px]" />
          ))}
        </div>
      ) : styles.length === 0 ? (
        <div className="border border-dashed border-[#DCCFBF] dark:border-[#3D352E] rounded-[22px] px-6 py-10 text-center">
          <div className="font-serif text-[24px] text-[#2E2A26] dark:text-[#F5EFEA]">No style packs yet</div>
          <p className="mx-auto mt-2 max-w-[44ch] text-[#8A7E73] dark:text-[#A69B90] text-[14.5px] leading-[1.55]">
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
                    ? 'bg-[#FFF3EA] dark:bg-[#2C1C14] border-[1.5px] border-[#C4633E] dark:border-[#E07A52] shadow-[0_14px_28px_-20px_rgba(196,99,62,0.9)] dark:shadow-none'
                    : 'bg-[#FFFDFA] dark:bg-[#1C1916] border-[1.5px] border-[#EFE6DA] dark:border-[#2E2924]'
                }`}
              >
                <div className="relative aspect-[16/10] rounded-[14px] overflow-hidden bg-[#EFE6DA] dark:bg-[#2A2520]">
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
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#A08F80] dark:text-[#8C8074]">
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
                    <p className="text-[13px] text-[#8A7E73] dark:text-[#A69B90] leading-[1.5] line-clamp-2">{style.style_prompt}</p>
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
            className="px-3.5 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#8A7E73] dark:text-[#A69B90] text-[13.5px] cursor-pointer hover:border-[#C4633E] dark:hover:border-[#E07A52]"
          >
            Clear style
          </button>
        )}
        {styleChosen && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF1E6] dark:bg-[#1E281C] text-[#5C6B50] dark:text-[#8FA87F] text-[13.5px] animate-rise">
            <span>Style locked in — step 3 is ready</span>
            <button
              onClick={scrollToCompose}
              className="border-none bg-transparent text-[#3F6B2F] dark:text-[#A4C495] font-medium underline underline-offset-2 cursor-pointer"
            >
              Compose ↓
            </button>
          </div>
        )}
      </div>

      {inspectStyle && (
        <StyleDetailsModal
          key={inspectStyle.id}
          style={inspectStyle}
          selectedStyleId={selectedStyleId}
          onClose={() => setInspectStyle(null)}
          onSelectStyle={onSelectStyle}
          onSave={async (source, mode, fields) => {
            const saved = await onSaveStyle(source, mode, fields);
            setInspectStyle(saved);
            return saved;
          }}
        />
      )}
    </section>
  );
};
