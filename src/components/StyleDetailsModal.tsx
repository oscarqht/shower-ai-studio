'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Check, Copy, Loader2, Pencil, X } from 'lucide-react';
import { SaveStyle, StyleEditFields, StylePack } from '@/types';

interface Props {
  style: StylePack;
  selectedStyleId: string | number | null;
  onClose: () => void;
  onSelectStyle: (id: string | number | null) => void;
  onSave: SaveStyle;
}

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCCFBF] dark:border-[#3D352E] px-4 py-2.5 text-sm hover:bg-[#F4EDE3] dark:hover:bg-[#2A2520] disabled:opacity-50';
const inputClass = 'mt-2 w-full rounded-xl border border-[#DCCFBF] dark:border-[#3D352E] bg-[#FAF5EE] dark:bg-[#25211D] px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C4633E]';

export function StyleDetailsModal({ style, selectedStyleId, onClose, onSelectStyle, onSave }: Props) {
  const [mode, setMode] = useState<'copy' | 'edit' | null>(null);
  const [fields, setFields] = useState<StyleEditFields>(style);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) closeRef.current();
      if (event.key === 'Tab') {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea') || []);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      previousFocus?.focus();
    };
  }, []);

  const startEditing = (nextMode: 'copy' | 'edit') => {
    setFields({ ...style, title: nextMode === 'copy' ? `${style.title} (copy)` : style.title });
    setError('');
    setMode(nextMode);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode || savingRef.current) return;
    if (!fields.title.trim() || !fields.style_prompt.trim()) {
      setError('Enter a style name and style prompt.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(style, mode, {
        title: fields.title.trim(),
        style_prompt: fields.style_prompt.trim(),
        extra_style_instruction: fields.extra_style_instruction.trim(),
      });
      setMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save style. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return createPortal(
    <div onClick={() => { if (!saving) onClose(); }} className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="style-dialog-title" tabIndex={-1} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[26px] sm:rounded-[26px] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#2E2A26] dark:text-[#F5EFEA] p-5 sm:p-7 shadow-2xl outline-none">
        <div className="flex items-start gap-3 mb-3">
          <h3 id="style-dialog-title" className="font-serif text-[27px] flex-1">{mode === 'copy' ? 'Copy & edit style' : mode === 'edit' ? 'Edit style' : style.title}</h3>
          {!mode && <>
            <button type="button" title="Copy style pack name" aria-label="Copy style pack name" className="p-2 rounded-full hover:bg-[#C4633E]/10" onClick={async () => {
              try {
                await navigator.clipboard.writeText(style.title);
                setCopied(true);
                copyTimer.current = setTimeout(() => setCopied(false), 2000);
              } catch { setError('Could not copy the style name.'); }
            }}>{copied ? <Check size={18} /> : <Copy size={18} />}</button>
            <a href={`https://app.raindrop.io/my/${style.id}`} target="_blank" rel="noopener noreferrer" aria-label="Open in Raindrop" className="p-2"><ArrowUpRight size={18} /></a>
          </>}
          <button type="button" aria-label="Close style details" disabled={saving} onClick={onClose} className="p-2 rounded-full hover:bg-[#C4633E]/10 disabled:opacity-50"><X size={18} /></button>
        </div>
        <p className="text-sm text-[#8A7E73] dark:text-[#A69B90] mb-5">{mode === 'copy' ? 'Create a separate style with the same preview and references.' : mode === 'edit' ? 'Update this style’s name and instructions. Preview and references are kept.' : 'Browse details, modify this style, or make your own copy.'}</p>
        {mode ? (
          <form onSubmit={save} className="flex flex-col gap-4">
            <fieldset disabled={saving} className="flex flex-col gap-4">
              <label className="text-sm">Style name<input autoFocus required maxLength={255} className={inputClass} value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} /></label>
              <label className="text-sm">Style prompt<textarea required rows={6} className={inputClass} value={fields.style_prompt} onChange={(e) => setFields({ ...fields, style_prompt: e.target.value })} /></label>
              <label className="text-sm">Extra instructions<textarea rows={4} className={inputClass} value={fields.extra_style_instruction} onChange={(e) => setFields({ ...fields, extra_style_instruction: e.target.value })} /></label>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className={`${buttonClass} bg-[#C4633E] text-[#FFF7F1] hover:bg-[#B35633] dark:hover:bg-[#B35633]`}>
                {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving…' : mode === 'copy' ? 'Save copy' : 'Save changes'}
              </button>
              <button type="button" disabled={saving} className={buttonClass} onClick={() => { setMode(null); setError(''); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {style.preview_cover && <img src={style.preview_cover} alt={style.title} referrerPolicy="no-referrer" className="w-full max-h-56 object-cover rounded-2xl" />}
            {style.style_reference_links.length > 0 && <div><p className="text-xs uppercase tracking-wider mb-2">Reference images</p><div className="grid grid-cols-3 gap-2.5">{style.style_reference_links.map((link, index) => <img key={`${link}-${index}`} src={link} alt={`Reference ${index + 1}`} referrerPolicy="no-referrer" className="w-full aspect-square object-cover rounded-xl" />)}</div></div>}
            <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] p-4"><p className="text-xs uppercase tracking-wider mb-2">Style prompt</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{style.style_prompt || 'No style prompt defined.'}</p></div>
            {style.extra_style_instruction && <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] p-4"><p className="text-xs uppercase tracking-wider mb-2">Extra instructions</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{style.extra_style_instruction}</p></div>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button className={`${buttonClass} bg-[#C4633E] text-[#FFF7F1] hover:bg-[#B35633] dark:hover:bg-[#B35633]`} onClick={() => { onSelectStyle(style.id); onClose(); }}>{selectedStyleId === style.id ? <><Check size={16} /> Already selected</> : 'Use this style'}</button>
              <button className={buttonClass} onClick={() => startEditing('edit')}><Pencil size={16} /> Edit style</button>
              <button className={buttonClass} onClick={() => startEditing('copy')}><Copy size={16} /> Copy & edit</button>
            </div>
          </div>
        )}
      </div>
    </div>, document.body,
  );
}
