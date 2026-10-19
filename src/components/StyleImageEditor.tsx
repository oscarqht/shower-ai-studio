'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';

export interface StyleImageDraft {
  key: string;
  url: string;
  file?: File;
}

export interface StyleImagesDraft {
  cover: StyleImageDraft | null;
  references: StyleImageDraft[];
  coverChanged: boolean;
  referencesChanged: boolean;
}

interface Props {
  value: StyleImagesDraft;
  onChange: (value: StyleImagesDraft) => void;
  onError: (message: string) => void;
}

const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const uploadClass = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#DCCFBF] dark:border-[#3D352E] px-3 py-2 text-xs hover:bg-[#F4EDE3] dark:hover:bg-[#2A2520] focus-within:ring-2 focus-within:ring-[#C4633E]';

function ImagePreview({ image, alt }: { image: StyleImageDraft; alt: string }) {
  const [fileUrl, setFileUrl] = useState('');
  useEffect(() => {
    if (!image.file) return;
    const url = URL.createObjectURL(image.file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image.file]);
  const src = image.file ? fileUrl : image.url;
  return src ? <img src={src} alt={alt} referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : null;
}

export function StyleImageEditor({ value, onChange, onError }: Props) {
  const readFiles = (files: FileList | null): StyleImageDraft[] | null => {
    const selected = Array.from(files || []);
    if (!selected.length) return null;
    if (selected.some(file => !acceptedTypes.includes(file.type))) {
      onError('Choose PNG, JPEG, WebP, or GIF images.');
      return null;
    }
    if (selected.some(file => file.size > 10 * 1024 * 1024 || file.size === 0)) {
      onError('Each image must be between 1 byte and 10 MB.');
      return null;
    }
    onError('');
    return selected.map(file => ({ key: `image-${crypto.randomUUID()}`, url: '', file }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm mb-2">Cover image</p>
        {value.cover ? (
          <div className="aspect-[16/9] overflow-hidden rounded-xl bg-[#EFE6DA] dark:bg-[#25211D] mb-2">
            <ImagePreview image={value.cover} alt="Style cover preview" />
          </div>
        ) : <p className="text-sm text-[#8A7E73] dark:text-[#A69B90] mb-2">No cover image</p>}
        <div className="flex flex-wrap gap-2">
          <label className={uploadClass}>
            <Upload size={14} />{value.cover ? 'Replace cover' : 'Add cover'}
            <input type="file" accept={acceptedTypes.join(',')} aria-label={value.cover ? 'Replace cover image' : 'Add cover image'} className="sr-only" onChange={event => {
              const images = readFiles(event.target.files);
              event.target.value = '';
              if (images) onChange({ ...value, cover: images[0], coverChanged: true });
            }} />
          </label>
          {value.cover && <button type="button" className={uploadClass} onClick={() => onChange({ ...value, cover: null, coverChanged: true })}><Trash2 size={14} />Remove cover</button>}
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center gap-2 mb-2">
          <p className="text-sm">Reference images <span className="text-[#8A7E73] dark:text-[#A69B90]">({value.references.length}/50)</span></p>
          <label className={uploadClass}>
            <Plus size={14} />Add references
            <input type="file" multiple accept={acceptedTypes.join(',')} aria-label="Add reference images" className="sr-only" onChange={event => {
              const images = readFiles(event.target.files);
              event.target.value = '';
              if (!images) return;
              if (value.references.length + images.length > 50) {
                onError('A style can have up to 50 reference images.');
                return;
              }
              onChange({ ...value, references: [...value.references, ...images], referencesChanged: true });
            }} />
          </label>
        </div>
        {!value.references.length && <p className="text-sm text-[#8A7E73] dark:text-[#A69B90]">No reference images. Add one or more to guide the style.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.references.map((image, index) => (
            <div key={image.key} className="min-w-0">
              <div className="aspect-square overflow-hidden rounded-xl bg-[#EFE6DA] dark:bg-[#25211D] mb-1.5">
                <ImagePreview image={image} alt={`Style reference ${index + 1}`} />
              </div>
              <div className="flex gap-1">
                <label className={`${uploadClass} flex-1 !px-2`}>
                  <Upload size={13} />Replace
                  <input type="file" accept={acceptedTypes.join(',')} aria-label={`Replace reference ${index + 1}`} className="sr-only" onChange={event => {
                    const images = readFiles(event.target.files);
                    event.target.value = '';
                    if (images) onChange({ ...value, references: value.references.map((ref, i) => i === index ? images[0] : ref), referencesChanged: true });
                  }} />
                </label>
                <button type="button" aria-label={`Delete reference ${index + 1}`} className={`${uploadClass} !px-2`} onClick={() => onChange({ ...value, references: value.references.filter((_, i) => i !== index), referencesChanged: true })}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-[#8A7E73] dark:text-[#A69B90]">PNG, JPEG, WebP, or GIF. Up to 10 MB per image. Changes are saved when you save the style.</p>
    </div>
  );
}
