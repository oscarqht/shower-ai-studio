'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Info, X, Image as ImageIcon, Layers } from 'lucide-react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sort style pack cards in reverse order
  const reversedStyles = useMemo(() => {
    return [...styles].reverse();
  }, [styles]);

  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 backdrop-blur-sm space-y-4 shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-base-300">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-secondary/10 text-secondary rounded-xl border border-secondary/20">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-base-content flex items-center gap-2">
              2. Choose Style Pack
            </h2>
          </div>
        </div>

        {/* Selected Style Indicator & Deselect Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {selectedStyleId !== null && (
            <button
              onClick={() => onSelectStyle(null)}
              className="btn btn-sm btn-ghost border border-base-300 gap-1 text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Clear Style
            </button>
          )}
        </div>
      </div>

      {/* Styles Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 bg-base-300/50 rounded-xl border border-base-300" />
          ))}
        </div>
      ) : styles.length === 0 ? (
        /* Empty State */
        <div className="text-center py-8 border border-dashed border-base-300 rounded-xl bg-base-200/30 px-4">
          <Palette className="w-8 h-8 text-base-content/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-base-content">No Style Packs Loaded</p>
          <p className="text-[11px] text-base-content/60 max-w-sm mx-auto mt-1">
            Configure your Raindrop token in <strong className="text-base-content">Settings</strong> to load style collections under <code className="text-secondary">Shower &gt; Styles</code>.
          </p>
        </div>
      ) : (
        /* Style Grid Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {reversedStyles.map((style) => {
            const isSelected = selectedStyleId === style.id;

            return (
              <div
                key={style.id}
                onClick={() => onSelectStyle(isSelected ? null : style.id)}
                className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-secondary/10 border-secondary shadow-md ring-2 ring-secondary/40'
                    : 'bg-base-200/50 border-base-300 hover:border-secondary/50 hover:bg-base-200'
                }`}
              >
                {/* Preview Image Container */}
                <div className="relative aspect-video w-full bg-base-300 overflow-hidden">
                  {style.preview_cover ? (
                    <img
                      src={style.preview_cover}
                      alt={style.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-base-content/40 bg-base-200">
                      <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                      <span className="text-[10px]">No Style Preview</span>
                    </div>
                  )}

                  {/* Selection Radio Badge Top Right */}
                  <div
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-secondary text-secondary-content shadow-md'
                        : 'bg-black/60 text-transparent border border-white/40'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  {/* Info button top left */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectStyle(style);
                      }}
                      className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition backdrop-blur-xs"
                      title="Inspect style details & reference images"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Style Details Bottom */}
                <div className="p-3 bg-base-100 border-t border-base-300 space-y-1">
                  <h3 className="text-xs font-bold text-base-content truncate" title={style.title}>
                    {style.title}
                  </h3>
                  {style.style_prompt && (
                    <p className="text-[11px] text-base-content/70 line-clamp-2 leading-tight">
                      {style.style_prompt}
                    </p>
                  )}
                  {style.extra_style_instruction && (
                    <p className="text-[10px] text-secondary truncate font-mono pt-0.5">
                      Note: {style.extra_style_instruction}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Style Inspection Modal */}
      {inspectStyle && mounted && createPortal(
        <div
          className="modal modal-open bg-black/60 backdrop-blur-sm fixed inset-0 z-[999] flex items-center justify-center p-4"
          onClick={() => setInspectStyle(null)}
        >
          <div
            className="modal-box max-w-lg p-5 bg-base-100 border border-base-300 shadow-2xl rounded-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <h3 className="text-sm font-bold text-base-content flex items-center gap-2">
                <Palette className="w-4 h-4 text-secondary" />
                {inspectStyle.title}
              </h3>
              <button
                type="button"
                onClick={() => setInspectStyle(null)}
                className="btn btn-xs btn-ghost btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Cover */}
            {inspectStyle.preview_cover && (
              <div className="rounded-xl overflow-hidden max-h-56 bg-base-200 border border-base-300">
                <img
                  src={inspectStyle.preview_cover}
                  alt={inspectStyle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Style Prompt */}
            <div>
              <h4 className="text-xs font-semibold text-base-content/70 mb-1">Style Prompt (preview.jpg excerpt):</h4>
              <p className="text-xs text-base-content bg-base-200 p-3 rounded-xl border border-base-300 font-mono whitespace-pre-wrap">
                {inspectStyle.style_prompt || 'No style prompt excerpt defined.'}
              </p>
            </div>

            {/* Extra Style Instruction */}
            {inspectStyle.extra_style_instruction && (
              <div>
                <h4 className="text-xs font-semibold text-base-content/70 mb-1">Extra Style Instruction (preview.jpg note):</h4>
                <p className="text-xs text-secondary bg-base-200 p-2.5 rounded-xl border border-base-300 font-mono">
                  {inspectStyle.extra_style_instruction}
                </p>
              </div>
            )}

            {/* Reference Images List */}
            {inspectStyle.style_reference_links && inspectStyle.style_reference_links.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-content/70 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-secondary" />
                  Style Reference Images ({inspectStyle.style_reference_links.length}):
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {inspectStyle.style_reference_links.map((link, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-base-300 bg-base-200">
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

            <div className="modal-action pt-2">
              <button
                type="button"
                onClick={() => setInspectStyle(null)}
                className="btn btn-sm btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
