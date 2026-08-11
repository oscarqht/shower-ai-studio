'use client';

import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Check,
  Info,
  X,
  Image as ImageIcon,
  Tag,
  Search,
  Minus,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Character } from '../types';

export function parseTagsFromNote(note?: string): string[] {
  if (!note || typeof note !== 'string') return [];
  const rawParts = note.split(',');
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
  const [tagSearchQuery, setTagSearchQuery] = useState('');
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

  // Sort character cards alphabetically by name (title)
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) =>
      (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' })
    );
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

  // Filter tags based on tag search query
  const filteredTagItems = useMemo(() => {
    if (!tagSearchQuery.trim()) return tagItems;
    const q = tagSearchQuery.toLowerCase().trim();
    return tagItems.filter((t) => t.name.toLowerCase().includes(q));
  }, [tagItems, tagSearchQuery]);

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
      setAddError('Character Title is required.');
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
      setEditError('Character Title is required.');
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

  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl p-6 sm:p-7 space-y-6 shadow-sm">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-base-300">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
            <User className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-base-content">
              1. Choose Character
            </h2>
            <span className="text-xs font-medium text-base-content/50">Multi-select</span>
            {selectedCharacterIds.length > 0 && (
              <span className="badge badge-primary font-semibold">
                {selectedCharacterIds.length} selected
              </span>
            )}
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          {/* Add Character Button */}
          {hasRaindropToken && onAddCharacter && (
            <button
              id="open-add-character-modal-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-sm btn-primary gap-1.5"
              title="Add a new character item to Raindrop"
            >
              <Plus className="w-4 h-4" />
              <span>Add Character</span>
            </button>
          )}

          {/* Clear All Selections Button */}
          {selectedCharacterIds.length > 0 && (
            <button
              onClick={onClearSelection}
              className="btn btn-sm btn-ghost border border-base-300 gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Characters Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-48 bg-base-300/50 rounded-xl" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        /* Empty State */
        <div className="text-center py-10 border border-dashed border-base-300 rounded-xl bg-base-200/30 px-6">
          <User className="w-9 h-9 text-base-content/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-base-content">No Characters Loaded</p>
          <p className="text-sm text-base-content/60 max-w-sm mx-auto mt-1.5 leading-relaxed">
            Configure your Raindrop token in <strong className="text-base-content">Settings</strong> to sync items from your <code className="text-primary">Shower &gt; Characters</code> collection.
          </p>
          {hasRaindropToken && onAddCharacter && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-sm btn-primary mt-4 gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Your First Character
            </button>
          )}
        </div>
      ) : (
        /* Character Grid Cards */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedCharacters.map((char) => {
            const isSelected = selectedCharacterIds.includes(char.id);

            return (
              <div
                key={char.id}
                onClick={() => onToggleCharacter(char.id)}
                className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/40'
                    : 'bg-base-200/50 border-base-300 hover:border-primary/50 hover:bg-base-200'
                }`}
              >
                {/* Character Cover Image */}
                <div className="relative aspect-square w-full bg-base-300 overflow-hidden">
                  {char.cover ? (
                    <img
                      src={char.cover}
                      alt={char.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base-content/40 bg-base-200">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* Top Badges (Selection indicator + Action Buttons) */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white transition-transform ${
                        isSelected
                          ? 'bg-primary scale-100 shadow-sm'
                          : 'bg-black/40 backdrop-blur-xs scale-90 opacity-70 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="w-2 h-2 rounded-full border border-white" />}
                    </div>

                    <div className="flex items-center gap-1 pointer-events-auto">
                      {/* Info / Edit button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(char);
                        }}
                        className="w-7 h-7 rounded-full bg-black/60 hover:bg-primary text-white flex items-center justify-center transition"
                        title="Edit character"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Character Meta Info Footer */}
                <div className="p-3 space-y-1">
                  <h3 className="text-sm font-bold text-base-content line-clamp-1 group-hover:text-primary transition-colors">
                    {char.title}
                  </h3>
                  {char.excerpt && (
                    <p className="text-xs text-base-content/60 line-clamp-2 leading-relaxed">
                      {char.excerpt}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tags Section */}
      {tagItems.length > 0 && characters.length > 0 && !isLoading && (
        <div className="pt-5 border-t border-base-300">
          <h3 className="text-sm font-bold text-base-content mb-3.5 flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            Filter by Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {tagItems.map((tag) => {
              const isSelected = tag.characterIds.every(id => selectedCharacterIds.includes(id)) && tag.characterIds.length > 0;
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => {
                    if (onSelectMultipleCharacters) {
                      if (isSelected) {
                        onSelectMultipleCharacters(tag.characterIds, 'remove');
                      } else {
                        onSelectMultipleCharacters(tag.characterIds, 'add');
                      }
                    }
                  }}
                  className={`badge badge-lg cursor-pointer hover:scale-105 transition-transform font-medium ${
                    isSelected ? 'badge-primary' : 'badge-outline bg-base-200 text-base-content/70'
                  }`}
                >
                  {tag.name} <span className="opacity-60 ml-1.5">({tag.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Add Character Modal */}
      {isAddModalOpen && mounted && createPortal(
        <div
          className="modal modal-open bg-black/60 backdrop-blur-sm fixed inset-0 z-[999] flex items-center justify-center p-4"
          onClick={handleResetAddForm}
        >
          <div
            className="modal-box max-w-lg p-0 overflow-hidden bg-base-100 border border-base-300 shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-base-300 bg-base-200/50">
              <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Add New Character to Raindrop
              </h3>
              <button
                onClick={handleResetAddForm}
                className="btn btn-sm btn-ghost btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCharacter} className="p-6 space-y-5">
              {addError && (
                <div className="alert alert-error text-sm py-2.5 px-4 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Title */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Character Title *</span>
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. Cyberpunk Detective"
                  className="input input-bordered w-full text-sm focus:input-primary"
                  required
                />
              </div>

              {/* Image File Selection */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Character Cover Image</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="file-input file-input-bordered file-input-primary w-full"
                />
                {previewUrl && (
                  <div className="mt-3 relative aspect-video w-full rounded-xl overflow-hidden border border-base-300 bg-base-200">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Excerpt / Prompt */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Prompt Excerpt</span>
                </label>
                <textarea
                  value={addExcerpt}
                  onChange={(e) => setAddExcerpt(e.target.value)}
                  placeholder="Character prompt description, clothing, appearance features..."
                  className="textarea textarea-bordered text-sm w-full h-24 focus:textarea-primary"
                />
              </div>

              {/* Tags Input */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Tags (Comma-separated)</span>
                </label>
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
                    placeholder="Add tag and press enter..."
                    className="input input-bordered flex-1 text-sm focus:input-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag()}
                    className="btn btn-ghost border border-base-300 text-sm"
                  >
                    Add Tag
                  </button>
                </div>

                {addTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {addTags.map((tag, idx) => (
                      <span key={idx} className="badge badge-primary badge-outline gap-1.5 py-3">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-error">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="modal-action pt-4 border-t border-base-200">
                <button
                  type="button"
                  onClick={handleResetAddForm}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to Raindrop
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Character Modal */}
      {editingCharacter && mounted && createPortal(
        <div
          className="modal modal-open bg-black/60 backdrop-blur-sm fixed inset-0 z-[999] flex items-center justify-center p-4"
          onClick={handleCloseEditModal}
        >
          <div
            className="modal-box max-w-lg p-0 overflow-hidden bg-base-100 border border-base-300 shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-base-300 bg-base-200/50">
              <h3 className="font-bold text-base text-base-content flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Edit Character
              </h3>
              <button
                onClick={handleCloseEditModal}
                className="btn btn-sm btn-ghost btn-circle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCharacter} className="p-6 space-y-5">
              {editError && (
                <div className="alert alert-error text-sm py-2.5 px-4 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Edit Title */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Character Title *</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input input-bordered w-full text-sm focus:input-primary"
                  required
                />
              </div>

              {/* Replace Cover Image */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Replace Cover Image</span>
                </label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditFileSelect}
                  accept="image/*"
                  className="file-input file-input-bordered file-input-primary w-full"
                />
                {editPreviewUrl && (
                  <div className="mt-3 relative aspect-video w-full rounded-xl overflow-hidden border border-base-300 bg-base-200">
                    <img src={editPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Edit Excerpt */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Prompt Excerpt</span>
                </label>
                <textarea
                  value={editExcerpt}
                  onChange={(e) => setEditExcerpt(e.target.value)}
                  className="textarea textarea-bordered text-sm w-full h-24 focus:textarea-primary"
                />
              </div>

              {/* Edit Tags */}
              <div className="form-control">
                <label className="label py-1.5">
                  <span className="label-text text-sm font-semibold text-base-content">Tags</span>
                </label>
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
                    placeholder="Add tag and press enter..."
                    className="input input-bordered flex-1 text-sm focus:input-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddEditTag()}
                    className="btn btn-ghost border border-base-300 text-sm"
                  >
                    Add Tag
                  </button>
                </div>

                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {editTags.map((tag, idx) => (
                      <span key={idx} className="badge badge-primary badge-outline gap-1.5 py-3">
                        {tag}
                        <button type="button" onClick={() => handleRemoveEditTag(tag)} className="hover:text-error">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="modal-action pt-4 border-t border-base-200 flex items-center justify-between">
                {hasRaindropToken && onDeleteCharacter && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingCharacter) {
                        const charToDelete = editingCharacter;
                        handleCloseEditModal();
                        setConfirmDeleteChar(charToDelete);
                      }
                    }}
                    className="btn btn-error text-white gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Character
                  </button>
                )}
                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn btn-primary gap-1.5"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Update Character
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteChar && mounted && createPortal(
        <div
          className="modal modal-open bg-black/60 backdrop-blur-sm fixed inset-0 z-[999] flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteChar(null)}
        >
          <div
            className="modal-box max-w-sm p-6 bg-base-100 border border-base-300 shadow-2xl rounded-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-base-content flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-error" />
              Delete Character?
            </h3>
            <p className="text-sm text-base-content/70 leading-relaxed">
              Are you sure you want to delete <strong className="text-base-content">{confirmDeleteChar.title}</strong> from your Raindrop collection? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="alert alert-error text-sm py-2.5 px-4 rounded-xl">
                {deleteError}
              </div>
            )}
            <div className="modal-action pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteChar(null)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn btn-error text-white gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
