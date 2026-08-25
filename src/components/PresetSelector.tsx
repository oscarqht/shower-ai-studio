'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  X,
  Image as ImageIcon,
  Info,
  Copy,
  ArrowUpRight,
  Sparkles,
  Users,
  Palette,
  Ratio,
  Cpu,
  Globe,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  SlidersHorizontal,
  Upload,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Preset, Character, StylePack, PresetModalInitialValues } from '../types';

const MODEL_OPTIONS = [
  { value: 'GPT Image 2', label: 'GPT Image 2' },
  { value: 'Gemini 3.1 Flash', label: 'Gemini 3.1 Flash' },
  { value: 'Gemini 3.1 Flash Lite', label: 'Gemini 3.1 Flash Lite' },
];

const ASPECT_RATIO_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '16:9', label: 'Landscape 16:9' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:1', label: 'Landscape 3:1' },
  { value: '9:16', label: 'Portrait 9:16' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '1:3', label: 'Portrait 1:3' },
];

const TEXT_LANGUAGE_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'No text', label: 'No text' },
  { value: 'English', label: 'English' },
  { value: '香港繁体粤语', label: '香港繁体粤语' },
];

interface PresetSelectorProps {
  presets: Preset[];
  selectedPresetId: string | number | null;
  presetCollectionId?: string | number | null;
  onSelectPreset: (preset: Preset | null) => void;
  isLoading?: boolean;
  onAddPreset?: (presetData: {
    title: string;
    prompt: string;
    previewImageFile?: File;
    previewImageDataUrl?: string;
    model?: string;
    aspectRatio?: string;
    textLanguage?: string;
    stylePackName?: string;
    characterNames?: string[];
  }) => Promise<void>;
  onDeletePreset?: (presetId: string | number) => Promise<void>;
  availableCharacters?: Character[];
  availableStyles?: StylePack[];
  currentWorkspaceValues?: {
    prompt?: string;
    model?: string;
    aspectRatio?: string;
    textLanguage?: string;
    stylePackName?: string;
    characterNames?: string[];
  };
  hasRaindropToken?: boolean;
  isAddModalOpen?: boolean;
  onOpenAddModal?: (initialValues?: PresetModalInitialValues) => void;
  onCloseAddModal?: () => void;
  initialModalValues?: PresetModalInitialValues | null;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  presets,
  selectedPresetId,
  presetCollectionId,
  onSelectPreset,
  isLoading = false,
  onAddPreset,
  onDeletePreset,
  availableCharacters = [],
  availableStyles = [],
  currentWorkspaceValues,
  hasRaindropToken = false,
  isAddModalOpen: propsIsAddModalOpen,
  onOpenAddModal,
  onCloseAddModal,
  initialModalValues,
}) => {
  const [inspectPreset, setInspectPreset] = useState<Preset | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Add Preset Modal State
  const [internalIsAddModalOpen, setInternalIsAddModalOpen] = useState(false);
  const isControlledAddModal = propsIsAddModalOpen !== undefined;
  const isAddModalOpen = isControlledAddModal ? propsIsAddModalOpen : internalIsAddModalOpen;

  const [addTitle, setAddTitle] = useState('');
  const [addPrompt, setAddPrompt] = useState('');
  const [addModel, setAddModel] = useState('GPT Image 2');
  const [addAspectRatio, setAddAspectRatio] = useState('Auto');
  const [addTextLanguage, setAddTextLanguage] = useState('Auto');
  const [addStylePackName, setAddStylePackName] = useState('');
  const [addCharacterNames, setAddCharacterNames] = useState<string[]>([]);
  const [customCharInput, setCustomCharInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Delete Confirmation Modal State
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<Preset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When modal is opened, sync initial values or workspace values
  useEffect(() => {
    if (isAddModalOpen) {
      if (initialModalValues) {
        setAddPrompt(initialModalValues.prompt !== undefined ? initialModalValues.prompt : '');
        setAddModel(initialModalValues.model || 'GPT Image 2');
        setAddAspectRatio(initialModalValues.aspectRatio || 'Auto');
        setAddTextLanguage(initialModalValues.textLanguage || 'Auto');
        setAddStylePackName(initialModalValues.stylePackName || '');
        setAddCharacterNames(initialModalValues.characterNames || []);
      } else if (currentWorkspaceValues) {
        setAddPrompt(currentWorkspaceValues.prompt !== undefined ? currentWorkspaceValues.prompt : '');
        setAddModel(currentWorkspaceValues.model || 'GPT Image 2');
        setAddAspectRatio(currentWorkspaceValues.aspectRatio || 'Auto');
        setAddTextLanguage(currentWorkspaceValues.textLanguage || 'Auto');
        setAddStylePackName(currentWorkspaceValues.stylePackName || '');
        setAddCharacterNames(currentWorkspaceValues.characterNames || []);
      }
      setAddTitle('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setAddError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isAddModalOpen, initialModalValues, currentWorkspaceValues]);

  const handleOpenAddModalInternal = () => {
    if (onOpenAddModal) {
      onOpenAddModal(currentWorkspaceValues || undefined);
    } else {
      if (currentWorkspaceValues) {
        setAddPrompt(currentWorkspaceValues.prompt !== undefined ? currentWorkspaceValues.prompt : '');
        setAddModel(currentWorkspaceValues.model || 'GPT Image 2');
        setAddAspectRatio(currentWorkspaceValues.aspectRatio || 'Auto');
        setAddTextLanguage(currentWorkspaceValues.textLanguage || 'Auto');
        setAddStylePackName(currentWorkspaceValues.stylePackName || '');
        setAddCharacterNames(currentWorkspaceValues.characterNames || []);
      }
      setInternalIsAddModalOpen(true);
    }
  };

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const selectedPreset = presets.find((p) => String(p.id) === String(selectedPresetId)) || null;
  const isPresetChosen = selectedPresetId !== null && Boolean(selectedPreset);
  const presetCountLabel = isPresetChosen ? '1 selected' : `${presets.length} presets`;

  const scrollToCompose = () => {
    const section = document.getElementById('composition-section');
    if (section) {
      const headerOffset = 80;
      const targetPosition = section.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  };

  // Image Selection Handler
  const handleFileProcess = (file: File) => {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle character in new preset
  const handleToggleCharacterName = (charName: string) => {
    const trimmed = charName.trim();
    if (!trimmed) return;
    setAddCharacterNames((prev) =>
      prev.includes(trimmed) ? prev.filter((c) => c !== trimmed) : [...prev, trimmed]
    );
  };

  const handleAddCustomChar = () => {
    const trimmed = customCharInput.trim();
    if (trimmed && !addCharacterNames.includes(trimmed)) {
      setAddCharacterNames([...addCharacterNames, trimmed]);
      setCustomCharInput('');
    }
  };

  // Pre-fill from current workspace
  const handlePrefillFromWorkspace = () => {
    if (!currentWorkspaceValues) return;
    if (currentWorkspaceValues.prompt) setAddPrompt(currentWorkspaceValues.prompt);
    if (currentWorkspaceValues.model) setAddModel(currentWorkspaceValues.model);
    if (currentWorkspaceValues.aspectRatio) setAddAspectRatio(currentWorkspaceValues.aspectRatio);
    if (currentWorkspaceValues.textLanguage) setAddTextLanguage(currentWorkspaceValues.textLanguage);
    if (currentWorkspaceValues.stylePackName) setAddStylePackName(currentWorkspaceValues.stylePackName);
    if (currentWorkspaceValues.characterNames && currentWorkspaceValues.characterNames.length > 0) {
      setAddCharacterNames(currentWorkspaceValues.characterNames);
    }
  };

  const handleResetAddForm = () => {
    setAddTitle('');
    setAddPrompt('');
    setAddModel('GPT Image 2');
    setAddAspectRatio('Auto');
    setAddTextLanguage('Auto');
    setAddStylePackName('');
    setAddCharacterNames([]);
    setCustomCharInput('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setAddError(null);
    if (!isControlledAddModal) {
      setInternalIsAddModalOpen(false);
    }
    if (onCloseAddModal) {
      onCloseAddModal();
    }
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      setAddError('A preset title is required.');
      return;
    }

    setIsSaving(true);
    setAddError(null);

    try {
      if (onAddPreset) {
        await onAddPreset({
          title: addTitle.trim(),
          prompt: addPrompt.trim(),
          previewImageFile: selectedFile || undefined,
          previewImageDataUrl: previewUrl || undefined,
          model: addModel,
          aspectRatio: addAspectRatio,
          textLanguage: addTextLanguage,
          stylePackName: addStylePackName.trim() || undefined,
          characterNames: addCharacterNames.length > 0 ? addCharacterNames : undefined,
        });
      }
      handleResetAddForm();
    } catch (err: any) {
      setAddError(err.message || 'Failed to save preset.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeletePreset || !onDeletePreset) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeletePreset(confirmDeletePreset.id);
      if (inspectPreset && String(inspectPreset.id) === String(confirmDeletePreset.id)) {
        setInspectPreset(null);
      }
      setConfirmDeletePreset(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete preset.');
    } finally {
      setIsDeleting(false);
    }
  };

  const inputClasses =
    'w-full px-3.5 py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FCFAF6] dark:bg-[#25211D] text-[14.5px] text-[#2E2A26] dark:text-[#F5EFEA] outline-none focus:border-[#C4633E] dark:focus:border-[#E07A52]';
  const labelClasses = 'flex flex-col gap-1.5 text-[13.5px] text-[#6E6459] dark:text-[#A69B90]';

  return (
    <section
      id="presets-section"
      className="rounded-[24px] border border-[#EAE0D4] dark:border-[#2E2924] bg-[#FFFDFA] dark:bg-[#1C1916] overflow-hidden transition-all duration-300 shadow-[0_4px_20px_-10px_rgba(88,66,48,0.06)] dark:shadow-none"
    >
      {/* Header Bar / Collapsible Toggle */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer select-none hover:bg-[#FAF5EE]/60 dark:hover:bg-[#25211D]/60 transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-[#FAF5EE] dark:bg-[#25211D] border border-[#E6DCCF] dark:border-[#332C26] text-[#7A6F64] dark:text-[#A69B90] flex items-center justify-center shrink-0 transition-transform duration-200"
            aria-label={isExpanded ? 'Collapse curated presets' : 'Expand curated presets'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#C4633E] dark:text-[#E07A52]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#8A7E73] dark:text-[#A69B90]" />
            )}
          </button>

          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 truncate">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#C4633E] dark:text-[#E07A52] bg-[#F7E7DC] dark:bg-[#2C1C14] px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 inline-block" />
                PRESETS
              </span>
              <h3 className="font-serif font-normal text-[20px] sm:text-[23px] text-[#2E2A26] dark:text-[#F5EFEA] truncate">
                Curated Presets
              </h3>
            </div>
            <span className="text-xs sm:text-[13px] text-[#8A7E73] dark:text-[#A69B90] truncate">
              {presetCountLabel} • Quick recipes for cast, style & prompt
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {selectedPreset && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-[#EDF1E6] dark:bg-[#1E281C] text-[#5C6B50] dark:text-[#8FA87F] font-medium">
              Active: {selectedPreset.title}
            </span>
          )}
          {onAddPreset && (
            <button
              type="button"
              id="header-add-preset-btn"
              onClick={handleOpenAddModalInternal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2E2A26] dark:border-[#3D352E] bg-[#2E2A26] dark:bg-[#25211D] text-[#FDF6EE] dark:text-[#F5EFEA] text-[12.5px] font-medium hover:bg-[#433D37] dark:hover:bg-[#2E2924] transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add preset</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="px-5 sm:px-6 pt-1 pb-6 border-t border-[#F2E9DE] dark:border-[#2E2924] bg-[#FFFDFC] dark:bg-[#181512]">
          <p className="mb-4 mt-3 text-[#8A7E73] dark:text-[#A69B90] text-[14px]">
            Select a ready-to-use recipe to instantly fill in your cast, style pack, composition prompt, and generator settings.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px] animate-pulse py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="aspect-[16/10] bg-[#EFE6DA]/60 dark:bg-[#25211D] rounded-[20px]" />
              ))}
            </div>
          ) : presets.length === 0 ? (
            <div className="border border-dashed border-[#DCCFBF] dark:border-[#3D352E] rounded-[22px] px-6 py-9 text-center bg-[#FFFDFA]/60 dark:bg-[#1C1916]/60 my-2">
              <div className="font-serif text-[22px] text-[#2E2A26] dark:text-[#F5EFEA]">No presets found</div>
              <p className="mx-auto mt-2 max-w-[48ch] text-[#8A7E73] dark:text-[#A69B90] text-[14px] leading-[1.55]">
                Create shot recipes in your <strong className="text-[#2E2A26] dark:text-[#F5EFEA]">Presets</strong> collection in Raindrop, or click below to save your first preset recipe.
              </p>
              {onAddPreset && (
                <button
                  id="add-first-preset-btn"
                  onClick={handleOpenAddModalInternal}
                  className="mt-4 inline-flex items-center gap-2 px-[18px] py-2.5 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer shadow-sm hover:opacity-95"
                >
                  <Plus className="w-4 h-4" />
                  Add a preset
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-[18px]">
              {presets.map((preset) => {
                const isSelected = String(selectedPresetId) === String(preset.id);

                return (
                  <div
                    key={preset.id}
                    onClick={() => onSelectPreset(isSelected ? null : preset)}
                    className={`rounded-[20px] p-2 cursor-pointer transition-transform hover:-translate-y-0.5 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#FFF3EA] dark:bg-[#2C1C14] border-[1.5px] border-[#C4633E] dark:border-[#E07A52] shadow-[0_14px_28px_-20px_rgba(196,99,62,0.9)] dark:shadow-none'
                        : 'bg-[#FFFDFA] dark:bg-[#1C1916] border-[1.5px] border-[#EFE6DA] dark:border-[#2E2924]'
                    }`}
                  >
                    <div>
                      <div className="relative aspect-[16/10] rounded-[14px] overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D]">
                        {preset.preview_image ? (
                          <img
                            src={preset.preview_image}
                            alt={preset.title}
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
                          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3" /> Selected
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectPreset(preset);
                          }}
                          title="Inspect preset details"
                          className="absolute bottom-2 right-2 p-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[rgba(255,253,250,0.92)] dark:bg-[rgba(28,25,22,0.92)] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#F8F3ED] dark:hover:bg-[#2A2520] transition-colors shadow-sm"
                        >
                          <Info className="w-[18px] h-[18px]" />
                        </button>
                      </div>

                      <div className="px-1.5 pt-2.5 pb-1 flex flex-col gap-1">
                        <div className="text-[16px] font-medium text-[#2E2A26] dark:text-[#F5EFEA] truncate" title={preset.title}>
                          {preset.title}
                        </div>
                        {preset.prompt && (
                          <p className="text-[13px] text-[#8A7E73] dark:text-[#A69B90] leading-[1.45] line-clamp-2">{preset.prompt}</p>
                        )}
                      </div>
                    </div>

                    {/* Metadata Pills / Tags */}
                    <div className="px-1.5 pt-2 flex flex-wrap gap-1.5 mt-auto border-t border-[#F4ECE2]/80 dark:border-[#2E2924]">
                      {preset.style_pack_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4EDE3] dark:bg-[#25211D] text-[11.5px] text-[#6E6459] dark:text-[#D5CCC3] max-w-[140px] truncate" title={`Style: ${preset.style_pack_name}`}>
                          <Palette className="w-3 h-3 shrink-0 text-[#A08F80] dark:text-[#8C8074]" />
                          <span className="truncate">{preset.style_pack_name}</span>
                        </span>
                      )}
                      {preset.character_names && preset.character_names.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4EDE3] dark:bg-[#25211D] text-[11.5px] text-[#6E6459] dark:text-[#D5CCC3] max-w-[140px] truncate" title={`Cast: ${preset.character_names.join(', ')}`}>
                          <Users className="w-3 h-3 shrink-0 text-[#A08F80] dark:text-[#8C8074]" />
                          <span className="truncate">{preset.character_names.join(', ')}</span>
                        </span>
                      )}
                      {preset.model && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF5EE] dark:bg-[#25211D] border border-[#EFE6DA] dark:border-[#332C26] text-[11px] font-mono text-[#8A7E73] dark:text-[#A69B90]">
                          <Cpu className="w-2.5 h-2.5 text-[#A08F80] dark:text-[#8C8074]" />
                          <span>{preset.model}</span>
                        </span>
                      )}
                      {preset.aspect_ratio && preset.aspect_ratio !== 'Auto' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF5EE] dark:bg-[#25211D] border border-[#EFE6DA] dark:border-[#332C26] text-[11px] font-mono text-[#8A7E73] dark:text-[#A69B90]">
                          <Ratio className="w-2.5 h-2.5 text-[#A08F80] dark:text-[#8C8074]" />
                          <span>{preset.aspect_ratio}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Action Bar for Presets */}
          <div className="flex items-center justify-between gap-3 mt-5 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              {onAddPreset && (
                <button
                  id="open-add-preset-modal-btn"
                  onClick={handleOpenAddModalInternal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#2E2A26] dark:border-[#3D352E] bg-[#2E2A26] dark:bg-[#25211D] text-[#FDF6EE] dark:text-[#F5EFEA] text-[13.5px] font-medium hover:bg-[#433D37] dark:hover:bg-[#2E2924] transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add preset</span>
                </button>
              )}

              {selectedPresetId !== null && (
                <button
                  id="clear-preset-selection-btn"
                  onClick={() => onSelectPreset(null)}
                  className="px-3.5 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#8A7E73] dark:text-[#A69B90] text-[13.5px] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA] transition-colors cursor-pointer"
                >
                  Clear preset
                </button>
              )}
            </div>

            {isPresetChosen && selectedPreset && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF1E6] dark:bg-[#1E281C] text-[#5C6B50] dark:text-[#8FA87F] text-[13.5px] animate-rise">
                <span>
                  Preset active: <strong className="font-medium text-[#384d2b] dark:text-[#A4C494]">{selectedPreset.title}</strong>
                </span>
                <button
                  onClick={scrollToCompose}
                  className="border-none bg-transparent text-[#3F6B2F] dark:text-[#8FA87F] font-medium underline underline-offset-2 hover:opacity-80 cursor-pointer"
                >
                  Review composition ↓
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Preset Modal */}
      {isAddModalOpen && mounted &&
        createPortal(
          <div
            onClick={handleResetAddForm}
            className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-[rgba(0,0,0,0.65)] backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#FFFDFA] dark:bg-[#1C1916] border border-transparent dark:border-[#2E2924] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
            >
              <div className="flex items-start gap-3.5 mb-1.5">
                <div className="flex-1">
                  <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#C4633E] dark:text-[#E07A52]">
                    Preset Recipe
                  </span>
                  <h3 className="font-serif text-[26px] sm:text-[28px] text-[#2E2A26] dark:text-[#F5EFEA]">New Preset</h3>
                </div>
                <button
                  onClick={handleResetAddForm}
                  className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap mb-4 pb-3 border-b border-[#F4ECE2] dark:border-[#2E2924]">
                <p className="text-[#8A7E73] dark:text-[#A69B90] text-[14px] leading-[1.5]">
                  Select a local image and configure the recipe parameters to sync to Raindrop.
                </p>
                {currentWorkspaceValues && (currentWorkspaceValues.prompt || currentWorkspaceValues.stylePackName || (currentWorkspaceValues.characterNames && currentWorkspaceValues.characterNames.length > 0)) && (
                  <button
                    type="button"
                    onClick={handlePrefillFromWorkspace}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FAF5EE] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] text-[12.5px] hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Auto-fill from workspace</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSavePreset} className="flex flex-col gap-4">
                {addError && (
                  <div className="flex items-center gap-2 text-sm text-[#96402F] dark:text-[#F5AB88] bg-[#FBEAE5] dark:bg-[#2C1C14] border border-[#F1D3C9] dark:border-[#4D2B1C] rounded-xl px-4 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                {/* Preset Title (Required) */}
                <label className={labelClasses}>
                  <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA]">
                    Preset title <span className="text-[#C4633E] dark:text-[#E07A52]">*</span>
                  </span>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="e.g. Sunset Rooftop Duel"
                    className={inputClasses}
                    required
                  />
                </label>

                {/* Local Image Upload Area */}
                <div className={labelClasses}>
                  <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA]">Local Preview Image</span>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                      isDraggingFile
                        ? 'border-[#C4633E] dark:border-[#E07A52] bg-[#FFF5EE] dark:bg-[#2C1C14]'
                        : previewUrl
                        ? 'border-[#DCCFBF] dark:border-[#3D352E] bg-[#FAF5EE] dark:bg-[#25211D]'
                        : 'border-[#DCCFBF] dark:border-[#3D352E] bg-[#FCFAF6] dark:bg-[#25211D] hover:bg-[#F8F3ED] dark:hover:bg-[#2E2924]'
                    }`}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                        <div className="relative w-32 h-20 sm:w-40 sm:h-24 rounded-xl overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D] shadow-inner shrink-0">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA] truncate max-w-xs">
                            {selectedFile ? selectedFile.name : 'Selected image'}
                          </div>
                          <p className="text-[12.5px] text-[#8A7E73] dark:text-[#A69B90] mt-0.5">
                            {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready to upload'}
                          </p>
                          <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                            <span className="text-xs text-[#C4633E] dark:text-[#E07A52] underline underline-offset-2">Click to replace</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSelectedFile();
                              }}
                              className="px-2 py-0.5 rounded text-xs bg-[#F5EAE6] dark:bg-[#381E19] text-[#A0433A] dark:text-[#F5AB88] hover:bg-[#EED5CF] dark:hover:bg-[#4D2821]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center py-2">
                        <div className="w-10 h-10 rounded-full bg-[#F4EDE3] dark:bg-[#25211D] flex items-center justify-center text-[#8A7E73] dark:text-[#A69B90]">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[14px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">Choose an image file</span>
                          <span className="text-[13px] text-[#8A7E73] dark:text-[#A69B90]"> or drag and drop here</span>
                        </div>
                        <span className="text-[12px] text-[#A08F80] dark:text-[#7A7066]">PNG, JPG, WEBP up to 10MB</span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Composition Prompt */}
                <label className={labelClasses}>
                  <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA]">Composition Prompt / Shot Description</span>
                  <textarea
                    value={addPrompt}
                    onChange={(e) => setAddPrompt(e.target.value)}
                    rows={3}
                    placeholder="Describe scene action, framing, lighting, and composition..."
                    className={`${inputClasses} resize-vertical leading-[1.5]`}
                  />
                </label>

                {/* Style Pack Selection */}
                <div className={labelClasses}>
                  <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA] flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-[#A08F80] dark:text-[#8C8074]" />
                    Style Pack
                  </span>
                  {availableStyles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={addStylePackName}
                        onChange={(e) => setAddStylePackName(e.target.value)}
                        className={inputClasses}
                      >
                        <option value="">None / Custom</option>
                        {availableStyles.map((s) => (
                          <option key={s.id} value={s.title}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={addStylePackName}
                        onChange={(e) => setAddStylePackName(e.target.value)}
                        placeholder="Or custom style name"
                        className={inputClasses}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={addStylePackName}
                      onChange={(e) => setAddStylePackName(e.target.value)}
                      placeholder="e.g. Neo-Tokyo Neon Watercolor"
                      className={inputClasses}
                    />
                  )}
                </div>

                {/* Cast / Characters Multi-select */}
                <div className="flex flex-col gap-2 text-[13.5px] text-[#6E6459] dark:text-[#A69B90]">
                  <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#A08F80] dark:text-[#8C8074]" />
                    Cast / Characters in Preset
                  </span>

                  {availableCharacters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#FAF5EE] dark:bg-[#25211D] border border-[#EFE6DA] dark:border-[#332C26] max-h-32 overflow-y-auto">
                      {availableCharacters.map((char) => {
                        const isIncluded = addCharacterNames.includes(char.title);
                        return (
                          <button
                            key={char.id}
                            type="button"
                            onClick={() => handleToggleCharacterName(char.title)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] transition-colors cursor-pointer ${
                              isIncluded
                                ? 'bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] font-medium'
                                : 'bg-[#FFFDFA] dark:bg-[#1C1916] border border-[#E3D8CA] dark:border-[#3D352E] text-[#6E6459] dark:text-[#D5CCC3] hover:bg-[#F6F0E7] dark:hover:bg-[#2A2520]'
                            }`}
                          >
                            <span>{char.title}</span>
                            {isIncluded && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Active character chips */}
                  {addCharacterNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {addCharacterNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-[#F6F0E7] dark:bg-[#25211D] border border-[#EBE1D4] dark:border-[#332C26] text-[13px] text-[#5B5148] dark:text-[#D5CCC3]"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => setAddCharacterNames(addCharacterNames.filter((c) => c !== name))}
                            className="text-[#B0A396] hover:text-[#A0433A] dark:hover:text-[#F5AB88]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customCharInput}
                      onChange={(e) => setCustomCharInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomChar();
                        }
                      }}
                      placeholder="Add custom character name and press Enter"
                      className={`flex-1 ${inputClasses} py-2.5`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomChar}
                      className="px-4 py-2.5 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#25211D] text-[#5B5148] dark:text-[#D5CCC3] text-[14px] hover:bg-[#F6F0E7] dark:hover:bg-[#2E2924] cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Generator Parameters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <label className={labelClasses}>
                    <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA] flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-[#A08F80] dark:text-[#8C8074]" /> Model
                    </span>
                    <select
                      value={addModel}
                      onChange={(e) => setAddModel(e.target.value)}
                      className={inputClasses}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={labelClasses}>
                    <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA] flex items-center gap-1">
                      <Ratio className="w-3.5 h-3.5 text-[#A08F80] dark:text-[#8C8074]" /> Aspect Ratio
                    </span>
                    <select
                      value={addAspectRatio}
                      onChange={(e) => setAddAspectRatio(e.target.value)}
                      className={inputClasses}
                    >
                      {ASPECT_RATIO_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={labelClasses}>
                    <span className="font-medium text-[#2E2A26] dark:text-[#F5EFEA] flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-[#A08F80] dark:text-[#8C8074]" /> Text Language
                    </span>
                    <select
                      value={addTextLanguage}
                      onChange={(e) => setAddTextLanguage(e.target.value)}
                      className={inputClasses}
                    >
                      {TEXT_LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="flex items-center gap-3 pt-3 border-t border-[#F4ECE2] dark:border-[#2E2924]">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer shadow-[0_10px_20px_-10px_rgba(196,99,62,0.9)] dark:shadow-none hover:opacity-95 disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isSaving ? 'Creating Preset…' : 'Save preset'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAddForm}
                    disabled={isSaving}
                    className="px-5 py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#6E6459] dark:text-[#D5CCC3] text-[14.5px] hover:bg-[#F6F0E7] dark:hover:bg-[#25211D] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Preset Inspection Modal */}
      {inspectPreset && mounted &&
        createPortal(
          <div
            onClick={() => setInspectPreset(null)}
            className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-[rgba(0,0,0,0.65)] backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[#FFFDFA] dark:bg-[#1C1916] border border-transparent dark:border-[#2E2924] rounded-t-[26px] sm:rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
            >
              <div className="flex items-start gap-3.5 mb-1.5">
                <h3 className="font-serif text-[27px] text-[#2E2A26] dark:text-[#F5EFEA] flex-1">{inspectPreset.title}</h3>
                <div className="flex items-center gap-2">
                  {typeof inspectPreset.id === 'number' || /^\d+$/.test(String(inspectPreset.id)) ? (
                    <a
                      href={`https://app.raindrop.io/my/${inspectPreset.collection_id || presetCollectionId || '0'}/item/${inspectPreset.id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Raindrop.io"
                      className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  ) : null}
                  <button
                    onClick={() => setInspectPreset(null)}
                    title="Close"
                    className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center hover:bg-[#EAE1D3] dark:hover:bg-[#2E2924] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="mb-[18px] text-[#8A7E73] dark:text-[#A69B90] text-[14.5px] leading-[1.55]">
                Preset recipe breakdown and generation parameters.
              </p>

              <div className="flex flex-col gap-4">
                {inspectPreset.preview_image && (
                  <div className="rounded-2xl overflow-hidden bg-[#EFE6DA] dark:bg-[#25211D] max-h-64">
                    <img
                      src={inspectPreset.preview_image}
                      alt={inspectPreset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Prompt Card with Copy Action */}
                <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3.5 relative">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074]">
                      Composition Prompt
                    </div>
                    {inspectPreset.prompt && (
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(inspectPreset.prompt)}
                        title="Copy prompt"
                        className="p-1 rounded-md border border-[#EBE1D4] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#8A7E73] dark:text-[#D5CCC3] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA] hover:bg-[#F6F0E7] dark:hover:bg-[#2A2520] transition-colors text-xs flex items-center gap-1 px-2 cursor-pointer"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-[14.5px] leading-[1.6] text-[#4F4740] dark:text-[#D5CCC3] whitespace-pre-wrap">
                    {inspectPreset.prompt || 'No prompt specified.'}
                  </div>
                </div>

                {/* Configurations Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inspectPreset.style_pack_name && (
                    <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3">
                      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-1.5 flex items-center gap-1">
                        <Palette className="w-3 h-3" /> Style Pack
                      </div>
                      <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">{inspectPreset.style_pack_name}</div>
                    </div>
                  )}

                  {inspectPreset.character_names && inspectPreset.character_names.length > 0 && (
                    <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3">
                      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Cast / Characters
                      </div>
                      <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">
                        {inspectPreset.character_names.join(', ')}
                      </div>
                    </div>
                  )}

                  {inspectPreset.model && (
                    <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3">
                      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-1.5 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> AI Model
                      </div>
                      <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">{inspectPreset.model}</div>
                    </div>
                  )}

                  {inspectPreset.aspect_ratio && (
                    <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3">
                      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-1.5 flex items-center gap-1">
                        <Ratio className="w-3 h-3" /> Aspect Ratio
                      </div>
                      <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">{inspectPreset.aspect_ratio}</div>
                    </div>
                  )}

                  {inspectPreset.text_language && (
                    <div className="rounded-2xl bg-[#FAF5EE] dark:bg-[#25211D] border border-transparent dark:border-[#2E2924] px-4 py-3">
                      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074] mb-1.5 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Text Language
                      </div>
                      <div className="text-[14.5px] font-medium text-[#2E2A26] dark:text-[#F5EFEA]">{inspectPreset.text_language}</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap pt-2">
                  <button
                    onClick={() => {
                      onSelectPreset(inspectPreset);
                      setInspectPreset(null);
                    }}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[14.5px] font-medium cursor-pointer shadow-[0_10px_20px_-10px_rgba(196,99,62,0.9)] dark:shadow-none hover:opacity-95"
                  >
                    {String(selectedPresetId) === String(inspectPreset.id) ? (
                      <>
                        <Check className="w-4 h-4" /> Preset currently active
                      </>
                    ) : (
                      'Apply this preset'
                    )}
                  </button>

                  {onDeletePreset && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = inspectPreset;
                        setInspectPreset(null);
                        setConfirmDeletePreset(target);
                      }}
                      className="px-4 py-3 rounded-xl border border-[#E9D5CD] dark:border-[#4D2B1C] bg-transparent text-[#A0433A] dark:text-[#F5AB88] text-[14px] hover:bg-[#FDF2F0] dark:hover:bg-[#2C1C14] cursor-pointer"
                    >
                      Delete…
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {confirmDeletePreset && mounted &&
        createPortal(
          <div
            onClick={() => setConfirmDeletePreset(null)}
            className="fixed inset-0 z-[999] bg-[rgba(46,36,28,0.42)] dark:bg-[rgba(0,0,0,0.65)] backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#FFFDFA] dark:bg-[#1C1916] border border-transparent dark:border-[#2E2924] rounded-[26px] p-5 sm:p-7 animate-rise mx-auto"
            >
              <div className="flex items-start gap-3.5 mb-1.5">
                <h3 className="font-serif text-[27px] text-[#2E2A26] dark:text-[#F5EFEA] flex-1">Delete this preset?</h3>
                <button
                  onClick={() => setConfirmDeletePreset(null)}
                  className="w-8 h-8 rounded-full border-none bg-[#F4EDE3] dark:bg-[#25211D] text-[#6E6459] dark:text-[#D5CCC3] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mb-[18px] text-[#8A7E73] dark:text-[#A69B90] text-[14.5px] leading-[1.55]">
                This removes <strong className="text-[#2E2A26] dark:text-[#F5EFEA]">{confirmDeletePreset.title}</strong> from your Raindrop Presets collection. There is no undo.
              </p>
              {deleteError && (
                <div className="mb-3.5 text-sm text-[#96402F] dark:text-[#F5AB88] bg-[#FBEAE5] dark:bg-[#2C1C14] border border-[#F1D3C9] dark:border-[#4D2B1C] rounded-xl px-4 py-2.5">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-2.5 flex-wrap">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-none bg-[#A0433A] text-[#FFF3EF] text-[14.5px] font-medium cursor-pointer disabled:opacity-70"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete permanently
                </button>
                <button
                  onClick={() => setConfirmDeletePreset(null)}
                  className="px-5 py-3 rounded-xl border border-[#E3D8CA] dark:border-[#3D352E] bg-transparent text-[#5B5148] dark:text-[#D5CCC3] text-[14.5px] cursor-pointer"
                >
                  Keep it
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
