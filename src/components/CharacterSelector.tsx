'use client';

import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  X,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Character } from '../types';

export function parseTagsFromNote(note?: string): string[] {
  if (!note || typeof note !== 'string') return [];
  let tagsStr = note;
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === 'object' && parsed.tags !== undefined) {
      tagsStr = parsed.tags;
    }
  } catch (e) {
    // Not JSON, use raw string
  }
  const rawParts = tagsStr.split(',');
  const tagsSet = new Set<string>();

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      tagsSet.add(trimmed);
    }
  }
  return Array.from(tagsSet);
}

interface TagItem {
  name: string;
  key: string;
  count: number;
  characterIds: (string | number)[];
}

interface CharacterSelectorProps {
  characters: Character[];
  selectedCharacterIds: (string | number)[];
  onToggleCharacter: (characterId: string | number) => void;
  onSelectMultipleCharacters?: (characterIds: (string | number)[], mode?: 'add' | 'remove' | 'set') => void;
  onClearSelection: () => void;
  isLoading?: boolean;
  onAddCharacter?: (characterData: {
    title: string;
    excerpt: string;
    tags: string[];
    coverDataUrl?: string;
    imageFile?: File;
  }) => Promise<void>;
  onDeleteCharacter?: (characterId: string | number) => Promise<void>;
  onUpdateCharacter?: (
    characterId: string | number,
    characterData: {
      title: string;
      excerpt: string;
      tags: string[];
      coverDataUrl?: string;
      imageFile?: File;
    }
  ) => Promise<void>;
  hasRaindropToken?: boolean;
}

function ModalShell({
  onClose,
  children,
  wide = false,
}: {
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto bg-[#FFFDFA] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  characters,
  selectedCharacterIds,
  onToggleCharacter,
  onSelectMultipleCharacters,
  onClearSelection,
  isLoading = false,
  onAddCharacter,
  onDeleteCharacter,
  onUpdateCharacter,
  hasRaindropToken = false,
}) => {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Add Character Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addExcerpt, setAddExcerpt] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [addTags, setAddTags] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Character Modal State
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Character Modal State
  const [confirmDeleteChar, setConfirmDeleteChar] = useState<Character | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort character cards by index first (ascending), then alphabetically by name (title)
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const indexA = a.index !== undefined ? a.index : Number.MAX_SAFE_INTEGER;
      const indexB = b.index !== undefined ? b.index : Number.MAX_SAFE_INTEGER;

      if (indexA !== indexB) {
        return indexA - indexB;
      }

      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [characters]);

  // Extract, parse, unique, and count tags across all character notes sorted by count DESC
  const tagItems = useMemo<TagItem[]>(() => {
    const map: Record<string, TagItem> = {};

    characters.forEach((char) => {
      const tags = parseTagsFromNote(char.note);
      tags.forEach((tagStr) => {
        const key = tagStr.toLowerCase();
        if (!map[key]) {
          map[key] = {
            name: tagStr,
            key,
            count: 0,
            characterIds: [],
          };
        }
        map[key].count += 1;
        if (!map[key].characterIds.includes(char.id)) {
          map[key].characterIds.push(char.id);
        }
      });
    });

    return Object.values(map).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });
  }, [characters]);

  // Handlers for Add Character Form
  const handleAddTag = (tagToAdd?: string) => {
    const target = (tagToAdd !== undefined ? tagToAdd : tagInput).trim();
    if (target && !addTags.includes(target)) {
      setAddTags([...addTags, target]);
      if (tagToAdd === undefined) setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setAddTags(addTags.filter((t) => t !== tagToRemove));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAddError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setAddError(null);
  };

  const handleResetAddForm = () => {
    setAddTitle('');
    setAddExcerpt('');
    setTagInput('');
    setAddTags([]);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAddError(null);
    setIsAddModalOpen(false);
  };

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      setAddError('A name is required.');
      return;
    }

    setIsSaving(true);
    setAddError(null);

    try {
      if (onAddCharacter) {
        await onAddCharacter({
          title: addTitle.trim(),
          excerpt: addExcerpt.trim(),
          tags: addTags,
          coverDataUrl: previewUrl || undefined,
          imageFile: selectedFile || undefined,
        });
      }
      handleResetAddForm();
    } catch (err: any) {
      setAddError(err.message || 'Failed to save character.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers for Edit Character Form
  const handleOpenEditModal = (char: Character) => {
    setEditingCharacter(char);
    setEditTitle(char.title || '');
    setEditExcerpt(char.excerpt || '');
    setEditTags(parseTagsFromNote(char.note));
    setEditTagInput('');
    setEditSelectedFile(null);
    setEditPreviewUrl(char.cover || null);
    setEditError(null);
  };

  const handleCloseEditModal = () => {
    setEditingCharacter(null);
    setEditTitle('');
    setEditExcerpt('');
    setEditTags([]);
    setEditTagInput('');
    setEditSelectedFile(null);
    setEditPreviewUrl(null);
    setEditError(null);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setEditSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setEditPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setEditError(null);
  };

  const handleAddEditTag = (tagToAdd?: string) => {
    const target = (tagToAdd !== undefined ? tagToAdd : editTagInput).trim();
    if (target && !editTags.includes(target)) {
      setEditTags([...editTags, target]);
      if (tagToAdd === undefined) setEditTagInput('');
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };

  const handleSaveEditCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharacter) return;
    if (!editTitle.trim()) {
      setEditError('A name is required.');
      return;
    }

    setIsUpdating(true);
    setEditError(null);

    try {
      if (onUpdateCharacter) {
        await onUpdateCharacter(editingCharacter.id, {
          title: editTitle.trim(),
          excerpt: editExcerpt.trim(),
          tags: editTags,
          coverDataUrl: editPreviewUrl || undefined,
          imageFile: editSelectedFile || undefined,
        });
      }
      handleCloseEditModal();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update character.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handler for Delete Character
  const handleDeleteConfirm = async () => {
    if (!confirmDeleteChar || !onDeleteCharacter) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteCharacter(confirmDeleteChar.id);
      setConfirmDeleteChar(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete character.');
    } finally {
      setIsDeleting(false);
    }
  };

  const charCountLabel =
    selectedCharacterIds.length > 0
      ? `${selectedCharacterIds.length} of ${characters.length} selected`
      : `${characters.length} available`;

  const inputClasses =
    'w-full px-3.5 py-3 rounded-xl border border-[#E3D8CA] bg-[#FCFAF6] text-[14.5px] text-[#2E2A26] outline-none focus:border-[#C4633E]';
  const labelClasses = 'flex flex-col gap-1.5 text-[13.5px] text-[#6E6459]';

  return (
    <section>
      <div className="flex items-baseline gap-3.5 flex-wrap mb-1.5">
        <span className="font-mono text-[11px] tracking-[0.16em] text-[#C4633E]">STEP 01</span>
        <h2 className="font-serif font-normal text-[26px] sm:text-[34px] text-[#2E2A26]">Who&apos;s in the shot?</h2>
        <span className="font-mono text-[12.5px] text-[#8A7E73]">{charCountLabel}</span>
      </div>
      <p className="mb-[18px] text-[#8A7E73] text-[15px]">
        Pick as many characters as you like. Tap a tag to grab the whole group.
      </p>

      {/* Tag pills + actions */}
      <div className="flex flex-wrap gap-2 items-center mb-7">
        {tagItems.map((tag) => {
          const isSelected =
            tag.characterIds.length > 0 && tag.characterIds.every((id) => selectedCharacterIds.includes(id));
          return (
            <button
              key={tag.key}
              type="button"
              onClick={() => {
                if (!onSelectMultipleCharacters) return;
                if (isSelected) {
                  onSelectMultipleCharacters(tag.characterIds, 'remove');
                } else {
                  onSelectMultipleCharacters(tag.characterIds, 'add');
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13.5px] cursor-pointer transition-colors ${
                isSelected
                  ? 'border border-[#C4633E] bg-[#F7E7DC] text-[#A34E2C]'
                  : 'border border-[#E3D8CA] bg-[#FFFDFA] text-[#6E6459]'
              }`}
            >
              <span>{tag.name}</span>
              <span className="font-mono text-[11px] opacity-65">{tag.count}</span>
            </button>
          );
        })}
        <div className="flex-1 min-w-2" />
        {selectedCharacterIds.length > 0 && (
          <button
            onClick={onClearSelection}
            className="px-3.5 py-1.5 rounded-full border border-[#E3D8CA] bg-transparent text-[#8A7E73] text-[13.5px] hover:text-[#C4633E] hover:border-[#C4633E]"
          >
            Clear selection
          </button>
        )}
        {onAddCharacter && (
          <button
            id="open-add-character-modal-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full border border-[#2E2A26] bg-[#2E2A26] text-[#FDF6EE] text-[13.5px] font-medium"
          >
            + New character
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-[18px] animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-[3/4] bg-[#EFE6DA]/60 rounded-[20px]" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        /* Empty State */
        <div className="border border-dashed border-[#DCCFBF] rounded-[22px] px-6 py-10 text-center">
          <div className="font-serif text-[24px] text-[#2E2A26]">No characters yet</div>
          <p className="mx-auto mt-2 mb-[18px] max-w-[44ch] text-[#8A7E73] text-[14.5px] leading-[1.55]">
            Save characters to your Raindrop collection and re-sync, or add one right here — it&apos;ll live
            locally until you connect.
          </p>
          {onAddCharacter && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-[18px] py-2.5 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] cursor-pointer"
            >
              Add a character
            </button>
          )}
        </div>
      ) : (
        /* Character Grid Cards */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-[18px]">
          {sortedCharacters.map((char) => {
            const isSelected = selectedCharacterIds.includes(char.id);

            return (
              <div
                key={char.id}
                onClick={() => onToggleCharacter(char.id)}
                className={`group relative rounded-[20px] p-2 cursor-pointer transition-transform hover:-translate-y-0.5 ${
                  isSelected
                    ? 'bg-[#FFF3EA] border-[1.5px] border-[#C4633E] shadow-[0_14px_28px_-20px_rgba(196,99,62,0.9)]'
                    : 'bg-[#FFFDFA] border-[1.5px] border-[#EFE6DA]'
                }`}
              >
                <div className="relative aspect-[3/4] rounded-[14px] overflow-hidden bg-[repeating-linear-gradient(135deg,#F1E7DA_0_8px,#EADFCF_8px_16px)]">
                  {char.cover ? (
                    <img
                      src={char.cover}
                      alt={char.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#A08F80]">
                      <ImageIcon className="w-7 h-7 opacity-50" />
                    </div>
                  )}

                  <div
                    className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[13px] transition-opacity ${
                      isSelected
                        ? 'bg-[#C4633E] text-[#FFF7F1]'
                        : 'bg-[rgba(255,253,250,0.9)] border border-[#E3D8CA] text-transparent opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(char);
                    }}
                    title="Edit character"
                    className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full border-none bg-[rgba(255,253,250,0.92)] text-[#5B5148] flex items-center justify-center shadow-[0_2px_8px_rgba(80,60,45,0.18)]"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>

                <div className="px-1.5 pt-2.5 pb-1">
                  <div className="text-[15px] font-medium leading-tight text-[#2E2A26] truncate">{char.title}</div>
                  {char.excerpt && (
                    <div className="text-[13px] text-[#8A7E73] leading-[1.45] mt-1 line-clamp-2">{char.excerpt}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Character Modal */}
      {isAddModalOpen && mounted && (
        <ModalShell onClose={handleResetAddForm}>
          <div className="flex items-start gap-3.5 mb-1.5">
            <h3 className="font-serif text-[27px] text-[#2E2A26] flex-1">New character</h3>
            <button
              onClick={handleResetAddForm}
              className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mb-[18px] text-[#8A7E73] text-[14.5px] leading-[1.55]">
            Name is required. Everything else is optional and editable later.
          </p>

          <form onSubmit={handleSaveCharacter} className="flex flex-col gap-3.5">
            {addError && (
              <div className="flex items-center gap-2 text-sm text-[#96402F] bg-[#FBEAE5] border border-[#F1D3C9] rounded-xl px-4 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <label className={labelClasses}>
              Name (required)
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Mira Alvent"
                className={inputClasses}
                required
              />
            </label>

            <label className={labelClasses}>
              Description
              <textarea
                value={addExcerpt}
                onChange={(e) => setAddExcerpt(e.target.value)}
                rows={3}
                placeholder="Freckled, always mid-motion, wears a patched flight coat."
                className={`${inputClasses} resize-vertical leading-[1.5]`}
              />
            </label>

            <div className={labelClasses}>
              Reference image
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-dashed border-[#DCCFBF] bg-[#FCFAF6] text-left"
              >
                <span className="w-11 h-11 rounded-[10px] bg-[repeating-linear-gradient(135deg,#F1E7DA_0_6px,#EADFCF_6px_12px)] overflow-hidden shrink-0">
                  {previewUrl && <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />}
                </span>
                <span className="text-[14px] text-[#6E6459]">
                  {selectedFile ? selectedFile.name : 'Upload a reference image'}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            <div className="flex flex-col gap-2 text-[13.5px] text-[#6E6459]">
              Tags
              <div className="flex flex-wrap gap-1.5">
                {addTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-[#F6F0E7] border border-[#EBE1D4] text-[13px] text-[#5B5148]"
                  >
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="text-[#B0A396] hover:text-[#A0433A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  className={`flex-1 ${inputClasses} py-2.5`}
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="px-4 py-2.5 rounded-xl border border-[#E3D8CA] bg-[#FFFDFA] text-[#5B5148] text-[14px]"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex gap-2.5 flex-wrap pt-1.5">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] cursor-pointer disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save character
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Character Modal */}
      {editingCharacter && mounted && (
        <ModalShell onClose={handleCloseEditModal}>
          <div className="flex items-start gap-3.5 mb-1.5">
            <h3 className="font-serif text-[27px] text-[#2E2A26] flex-1">Edit character</h3>
            <button
              onClick={handleCloseEditModal}
              className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mb-[18px] text-[#8A7E73] text-[14.5px] leading-[1.55]">
            Name is required. Everything else is optional and editable later.
          </p>

          <form onSubmit={handleSaveEditCharacter} className="flex flex-col gap-3.5">
            {editError && (
              <div className="flex items-center gap-2 text-sm text-[#96402F] bg-[#FBEAE5] border border-[#F1D3C9] rounded-xl px-4 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <label className={labelClasses}>
              Name (required)
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={inputClasses}
                required
              />
            </label>

            <label className={labelClasses}>
              Description
              <textarea
                value={editExcerpt}
                onChange={(e) => setEditExcerpt(e.target.value)}
                rows={3}
                className={`${inputClasses} resize-vertical leading-[1.5]`}
              />
            </label>

            <div className={labelClasses}>
              Reference image
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-dashed border-[#DCCFBF] bg-[#FCFAF6] text-left"
              >
                <span className="w-11 h-11 rounded-[10px] bg-[repeating-linear-gradient(135deg,#F1E7DA_0_6px,#EADFCF_6px_12px)] overflow-hidden shrink-0">
                  {editPreviewUrl && <img src={editPreviewUrl} alt="Preview" className="w-full h-full object-cover" />}
                </span>
                <span className="text-[14px] text-[#6E6459]">
                  {editSelectedFile ? editSelectedFile.name : 'Replace reference image'}
                </span>
              </button>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditFileSelect}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-2 text-[13.5px] text-[#6E6459]">
              Tags
              <div className="flex flex-wrap gap-1.5">
                {editTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-[#F6F0E7] border border-[#EBE1D4] text-[13px] text-[#5B5148]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveEditTag(tag)}
                      className="text-[#B0A396] hover:text-[#A0433A]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEditTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  className={`flex-1 ${inputClasses} py-2.5`}
                />
                <button
                  type="button"
                  onClick={() => handleAddEditTag()}
                  className="px-4 py-2.5 rounded-xl border border-[#E3D8CA] bg-[#FFFDFA] text-[#5B5148] text-[14px]"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex gap-2.5 flex-wrap pt-1.5">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#C4633E] text-[#FFF7F1] text-[14.5px] cursor-pointer disabled:opacity-70"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save character
              </button>
              {onDeleteCharacter && (
                <button
                  type="button"
                  onClick={() => {
                    const charToDelete = editingCharacter;
                    handleCloseEditModal();
                    setConfirmDeleteChar(charToDelete);
                  }}
                  className="px-[18px] py-3 rounded-xl border border-[#E9D5CD] bg-transparent text-[#A0433A] text-[14.5px] cursor-pointer"
                >
                  Delete…
                </button>
              )}
            </div>
          </form>
        </ModalShell>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteChar && mounted && (
        <ModalShell onClose={() => setConfirmDeleteChar(null)}>
          <div className="flex items-start gap-3.5 mb-1.5">
            <h3 className="font-serif text-[27px] text-[#2E2A26] flex-1">Delete this character?</h3>
            <button
              onClick={() => setConfirmDeleteChar(null)}
              className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] text-[#6E6459] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mb-[18px] text-[#8A7E73] text-[14.5px] leading-[1.55]">
            This removes <strong className="text-[#2E2A26]">{confirmDeleteChar.title}</strong> from your Raindrop
            collection too. There is no undo.
          </p>
          {deleteError && (
            <div className="mb-3.5 text-sm text-[#96402F] bg-[#FBEAE5] border border-[#F1D3C9] rounded-xl px-4 py-2.5">
              {deleteError}
            </div>
          )}
          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#A0433A] text-[#FFF3EF] text-[14.5px] cursor-pointer disabled:opacity-70"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete permanently
            </button>
            <button
              onClick={() => setConfirmDeleteChar(null)}
              className="px-5 py-3 rounded-xl border border-[#E3D8CA] bg-transparent text-[#5B5148] text-[14.5px]"
            >
              Keep it
            </button>
          </div>
        </ModalShell>
      )}
    </section>
  );
};
