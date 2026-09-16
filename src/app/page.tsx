'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { PresetSelector } from '@/components/PresetSelector';
import { CharacterSelector } from '@/components/CharacterSelector';
import { StyleSelector } from '@/components/StyleSelector';
import { MoreStyleSelector, MORE_STYLES_CACHE_STORAGE_KEY } from '@/components/MoreStyleSelector';
import { GeneratorControls } from '@/components/GeneratorControls';
import { Character, StylePack, Preset, AppSettings, extractWorkflowId, composeWorkflowEndpoint, formatErrorMessage, PresetModalInitialValues } from '@/types';
import { AlertTriangle, CheckCircle2, LogIn } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'raindrop_ai_studio_settings_v1';
const INPUTS_STORAGE_KEY = 'raindrop_ai_studio_last_inputs_v1';
const RAINDROP_CACHE_STORAGE_KEY = 'raindrop_ai_studio_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedRaindropData {
  characters: Character[];
  styles: StylePack[];
  presets: Preset[];
  presetsCollectionId?: string | number | null;
  timestamp: number;
}

const getValidCachedRaindropData = (): CachedRaindropData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const timestamp = typeof parsed?.timestamp === 'number' ? parsed.timestamp : 0;

    // Invalidate and purge cache if older than 24 hours or missing timestamp
    if (!timestamp || Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(RAINDROP_CACHE_STORAGE_KEY);
      return null;
    }

    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      styles: Array.isArray(parsed.styles) ? parsed.styles : [],
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      presetsCollectionId: parsed.presetsCollectionId || null,
      timestamp,
    };
  } catch (e) {
    console.error('Failed to parse cached Raindrop data from localStorage:', e);
    try {
      localStorage.removeItem(RAINDROP_CACHE_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
};

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  // App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') {
      return { raindropToken: '', imageApiKey: '', imageWorkflowId: '', imageApiEndpoint: '' };
    }
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const workflowId = parsed.imageWorkflowId || extractWorkflowId(parsed.imageApiEndpoint || '');
        return {
          ...parsed,
          imageWorkflowId: workflowId,
          imageApiEndpoint: parsed.imageApiEndpoint || composeWorkflowEndpoint(workflowId, parsed.imageWorkflowUrl || parsed.imageWorkflowOrigin),
        };
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
    return {
      raindropToken: '',
      imageApiKey: '',
      imageWorkflowId: '',
      imageApiEndpoint: '',
    };
  });

  // Raindrop Data States (with 24h cache TTL check)
  const [characters, setCharacters] = useState<Character[]>(() => {
    const cached = getValidCachedRaindropData();
    return cached?.characters || [];
  });

  const [styles, setStyles] = useState<StylePack[]>(() => {
    const cached = getValidCachedRaindropData();
    return cached?.styles || [];
  });

  const [moreStyles, setMoreStyles] = useState<StylePack[]>(() => {
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

  const [presets, setPresets] = useState<Preset[]>(() => {
    const cached = getValidCachedRaindropData();
    return cached?.presets || [];
  });

  const [presetsCollectionId, setPresetsCollectionId] = useState<string | number | null>(() => {
    const cached = getValidCachedRaindropData();
    return cached?.presetsCollectionId || null;
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string | number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedPresetId !== undefined) {
          return parsed.selectedPresetId;
        }
      }
    } catch (e) {
      console.error('Failed to load saved preset selection:', e);
    }
    return null;
  });

  const [compositionPrompt, setCompositionPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.compositionPrompt === 'string') {
          return parsed.compositionPrompt;
        }
      }
    } catch (e) {
      console.error('Failed to load saved composition prompt:', e);
    }
    return '';
  });

  const [model, setModel] = useState<string>(() => {
    if (typeof window === 'undefined') return 'GPT Image 2';
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.model) return parsed.model;
      }
    } catch {}
    return 'GPT Image 2';
  });

  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Auto';
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.aspectRatio) return parsed.aspectRatio;
      }
    } catch {}
    return 'Auto';
  });

  const [textLanguage, setTextLanguage] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Auto';
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.textLanguage) return parsed.textLanguage;
      }
    } catch {}
    return 'Auto';
  });

  const [selectedCharacterIds, setSelectedCharacterIds] = useState<(string | number)[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.selectedCharacterIds)) {
          return parsed.selectedCharacterIds;
        }
      }
    } catch (e) {
      console.error('Failed to load saved character selection:', e);
    }
    return [];
  });

  const [selectedStyleId, setSelectedStyleId] = useState<string | number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedStyleId !== undefined) {
          return parsed.selectedStyleId;
        }
      }
    } catch (e) {
      console.error('Failed to load saved style selection:', e);
    }
    return null;
  });

  // Status & Loading States
  const [hasEnvToken, setHasEnvToken] = useState(false);
  const [isFetchingRaindrop, setIsFetchingRaindrop] = useState(false);
  const [raindropStatus, setRaindropStatus] = useState<'success' | 'partial' | 'error' | 'idle'>('idle');
  const [raindropMessage, setRaindropMessage] = useState<string | null>(null);

  // Modals & OAuth States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddPresetModalOpen, setIsAddPresetModalOpen] = useState(false);
  const [presetModalInitialValues, setPresetModalInitialValues] = useState<PresetModalInitialValues | null>(null);
  const [syncTestMessage, setSyncTestMessage] = useState<string | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [isLoggingInOAuth, setIsLoggingInOAuth] = useState(false);

  const handleSaveAsPreset = (payload: {
    prompt: string;
    model: string;
    aspectRatio: string;
    textLanguage: string;
    stylePackName?: string;
    characterNames?: string[];
  }) => {
    setPresetModalInitialValues({
      prompt: payload.prompt,
      model: payload.model,
      aspectRatio: payload.aspectRatio,
      textLanguage: payload.textLanguage,
      stylePackName: payload.stylePackName,
      characterNames: payload.characterNames,
    });
    setIsAddPresetModalOpen(true);
  };

  const handleOAuthLogin = async () => {
    setIsLoggingInOAuth(true);
    setRaindropMessage(null);
    try {
      const res = await fetch('/api/auth/login');
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setRaindropStatus('error');
        setRaindropMessage(data.message || 'Failed to start Raindrop OAuth login.');
        setIsLoggingInOAuth(false);
      }
    } catch (err: any) {
      setRaindropStatus('error');
      setRaindropMessage(`OAuth login error: ${formatErrorMessage(err)}`);
      setIsLoggingInOAuth(false);
    }
  };


  // Save settings helper
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    if (newSettings.raindropToken && newSettings.raindropToken.trim()) {
      const validCache = getValidCachedRaindropData();
      if (!validCache) {
        fetchRaindropData(newSettings.raindropToken);
      }
    }
  };

  // Refresh Token Function
  const refreshRaindropToken = useCallback(async (): Promise<string | null> => {
    if (!settings.raindropRefreshToken) return null;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: settings.raindropRefreshToken }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success' && data.access_token) {
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token || settings.raindropRefreshToken;
        const newExpiresAt = data.expires_at || (Date.now() + 14 * 86400 * 1000);

        setSettings((prev) => {
          const updated = {
            ...prev,
            raindropToken: newAccessToken,
            raindropRefreshToken: newRefreshToken,
            raindropExpiresAt: newExpiresAt,
          };
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {
            console.error('Failed to save refreshed token settings:', e);
          }
          return updated;
        });

        return newAccessToken;
      }
    } catch (e) {
      console.error('Error refreshing Raindrop token:', e);
    }
    return null;
  }, [settings.raindropRefreshToken]);

  // Raindrop Fetch Function
  const fetchRaindropData = useCallback(
    async (tokenToUse?: string, isRetry = false) => {
      const activeToken = tokenToUse !== undefined ? tokenToUse : settings.raindropToken;
      setIsFetchingRaindrop(true);
      setRaindropMessage(null);

      const hasValidToken = Boolean((activeToken && activeToken.trim()) || hasEnvToken);
      if (!hasValidToken) {
        setRaindropStatus('error');
        setRaindropMessage('Raindrop API Token is missing. Click Settings to enter your token or set RAINDROP_TOKEN.');
        setIsFetchingRaindrop(false);
        return;
      }

      try {
        const res = await fetch('/api/raindrop/fetch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: activeToken && activeToken.trim() ? activeToken.trim() : undefined }),
        });

        if (res.status === 401 && !isRetry && settings.raindropRefreshToken) {
          const refreshedToken = await refreshRaindropToken();
          if (refreshedToken) {
            return await fetchRaindropData(refreshedToken, true);
          }
        }

        const data = await res.json();

        if (res.ok && data.status === 'success') {
          const newChars = data.characters || [];
          const newStyles = data.styles || [];
          const newPresets = data.presets || [];
          const newPresetsCollectionId = data.presetsCollectionId || data.debugInfo?.presetsCollectionId || null;
          const newImageAppUrl = data.imageAppUrl || '';

          setCharacters(newChars);
          setStyles(newStyles);
          setPresets(newPresets);
          setPresetsCollectionId(newPresetsCollectionId);
          if (newImageAppUrl || data.hasUploadCapability !== undefined) {
            setSettings((prev) => {
              const updated = {
                ...prev,
                imageAppUrl: newImageAppUrl || prev.imageAppUrl,
                hasUploadCapability: data.hasUploadCapability !== undefined ? data.hasUploadCapability : prev.hasUploadCapability,
              };
              try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
              } catch (e) {
                console.error('Failed to save settings:', e);
              }
              return updated;
            });
          }

          setRaindropStatus('success');
          setRaindropMessage(
            `Successfully fetched ${newChars.length} characters, ${newStyles.length} style packs, and ${newPresets.length} presets from Raindrop Shower!`
          );

          try {
            localStorage.setItem(
              RAINDROP_CACHE_STORAGE_KEY,
              JSON.stringify({
                characters: newChars,
                styles: newStyles,
                presets: newPresets,
                presetsCollectionId: newPresetsCollectionId,
                timestamp: Date.now(),
              })
            );
          } catch (e) {
            console.error('Failed to cache Raindrop data in localStorage:', e);
          }
        } else {
          setRaindropStatus('error');
          setRaindropMessage(formatErrorMessage(data.message) || 'Failed to fetch from Raindrop API.');
        }
      } catch (err: any) {
        console.error('Error fetching Raindrop:', err);
        setRaindropStatus('error');
        setRaindropMessage(`Error: ${formatErrorMessage(err)}`);
      } finally {
        setIsFetchingRaindrop(false);
      }
    },
    [settings.raindropToken, settings.raindropRefreshToken, refreshRaindropToken, hasEnvToken]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let localToken = '';
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const workflowId = parsed.imageWorkflowId || extractWorkflowId(parsed.imageApiEndpoint || '');
        const loadedSettings = {
          ...parsed,
          imageWorkflowId: workflowId,
          imageApiEndpoint: parsed.imageApiEndpoint || composeWorkflowEndpoint(workflowId, parsed.imageWorkflowUrl || parsed.imageWorkflowOrigin),
        };
        localToken = loadedSettings.raindropToken || '';
        setSettings(loadedSettings);
        if (loadedSettings.raindropToken && loadedSettings.raindropToken.trim()) {
          const validCache = getValidCachedRaindropData();
          if (!validCache) {
            fetchRaindropData(loadedSettings.raindropToken);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load settings on mount:', e);
    }

    // Check if RAINDROP_TOKEN or OAuth is configured on server
    fetch('/api/auth/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasEnvToken) {
          setHasEnvToken(true);
          if (!localToken.trim()) {
            const validCache = getValidCachedRaindropData();
            if (!validCache) {
              fetchRaindropData('');
            }
          }
        }
      })
      .catch(() => {});

    setIsMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestRaindropSync = async (tokenToTest: string) => {
    setIsTestingSync(true);
    setSyncTestMessage(null);
    try {
      const res = await fetch('/api/raindrop/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest && tokenToTest.trim() ? tokenToTest.trim() : undefined }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSyncTestMessage(
          `Success! Found ${data.characters?.length || 0} characters, ${data.styles?.length || 0} styles, and ${data.presets?.length || 0} presets.`
        );
        if (tokenToTest && tokenToTest.trim()) {
          handleSaveSettings({
            ...settings,
            raindropToken: tokenToTest.trim(),
          });
        }
      } else {
        setSyncTestMessage(`Status: ${formatErrorMessage(data.message) || 'Failed'}`);
      }
    } catch (e: any) {
      setSyncTestMessage(`Error: ${formatErrorMessage(e)}`);
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleToggleCharacter = (id: string | number) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectMultipleCharacters = (
    ids: (string | number)[],
    mode: 'add' | 'remove' | 'set' = 'set'
  ) => {
    if (mode === 'set') {
      setSelectedCharacterIds(ids);
    } else if (mode === 'add') {
      setSelectedCharacterIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else if (mode === 'remove') {
      setSelectedCharacterIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  };

  const handleClearCharacters = () => {
    setSelectedCharacterIds([]);
  };

  const handleAddCharacter = async (charData: {
    title: string;
    excerpt: string;
    tags: string[];
    coverDataUrl?: string;
    imageFile?: File;
  }) => {
    const isConnected = Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);
    const tagsNoteStr = charData.tags.join(', ');
    const noteObj = { tags: tagsNoteStr };
    const noteJson = JSON.stringify(noteObj);

    if (isConnected) {
      const formData = new FormData();
      if (settings.raindropToken && settings.raindropToken.trim()) {
        formData.append('token', settings.raindropToken.trim());
      }
      formData.append('title', charData.title);
      formData.append('excerpt', charData.excerpt);
      formData.append('note', noteJson);
      if (charData.coverDataUrl) {
        formData.append('cover', charData.coverDataUrl);
      }
      if (charData.imageFile) {
        formData.append('imageFile', charData.imageFile);
      }

      const res = await fetch('/api/raindrop/character', {
        method: 'POST',
        body: formData,
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server endpoint error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || data.status !== 'success') {
        throw new Error(formatErrorMessage(data.message) || 'Failed to save character to Raindrop');
      }

      const newChar: Character = data.character;
      setCharacters((prev) => [newChar, ...prev.filter((c) => String(c.id) !== String(newChar.id))]);

      setRaindropStatus('success');
      setRaindropMessage(`Added character "${newChar.title}" to Raindrop Shower!`);

      await fetchRaindropData(settings.raindropToken);
    } else {
      const newChar: Character = {
        id: `char-local-${Date.now()}`,
        title: charData.title,
        excerpt: charData.excerpt,
        cover: charData.coverDataUrl || '',
        note: noteJson,
      };
      setCharacters((prev) => [newChar, ...prev]);
      setRaindropStatus('success');
      setRaindropMessage(`Added character "${newChar.title}" to local session!`);

      try {
        const currentCache = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
        const parsed = currentCache ? JSON.parse(currentCache) : { styles: [] };
        localStorage.setItem(
          RAINDROP_CACHE_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            characters: [newChar, ...(parsed.characters || [])],
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error('Failed to update cache:', e);
      }
    }
  };

  const handleUpdateCharacter = async (
    characterId: string | number,
    charData: {
      title: string;
      excerpt: string;
      tags: string[];
      coverDataUrl?: string;
      imageFile?: File;
    }
  ) => {
    const isConnected = Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);
    const isRaindropId = typeof characterId === 'number' || /^\d+$/.test(String(characterId));
    const tagsNoteStr = charData.tags.join(', ');

    let noteObj: any = { tags: tagsNoteStr };
    const existingChar = characters.find((c) => String(c.id) === String(characterId));
    if (existingChar && existingChar.note) {
      try {
        const parsed = JSON.parse(existingChar.note);
        if (parsed && typeof parsed === 'object') {
          noteObj = { ...parsed, tags: tagsNoteStr };
        }
      } catch (e) {
        // Not JSON
      }
    }
    const noteJson = JSON.stringify(noteObj);

    if (isConnected && isRaindropId) {
      const formData = new FormData();
      if (settings.raindropToken && settings.raindropToken.trim()) {
        formData.append('token', settings.raindropToken.trim());
      }
      formData.append('title', charData.title);
      formData.append('excerpt', charData.excerpt);
      formData.append('note', noteJson);
      if (charData.imageFile) {
        formData.append('imageFile', charData.imageFile);
      } else if (charData.coverDataUrl) {
        formData.append('cover', charData.coverDataUrl);
      }

      const res = await fetch(`/api/raindrop/character/${characterId}`, {
        method: 'POST',
        body: formData,
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server endpoint error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || data.status !== 'success') {
        throw new Error(formatErrorMessage(data.message) || 'Failed to update character on Raindrop');
      }

      const updatedChar: Character = data.character;
      setCharacters((prev) => prev.map((c) => (String(c.id) === String(characterId) ? updatedChar : c)));
      setSelectedCharacterIds((prev) =>
        prev.map((id) => (String(id) === String(characterId) ? updatedChar.id : id))
      );

      setRaindropStatus('success');
      setRaindropMessage(`Updated character "${updatedChar.title}" on Raindrop!`);

      await fetchRaindropData(settings.raindropToken);
    } else {
      const updatedChar: Character = {
        id: characterId,
        title: charData.title,
        excerpt: charData.excerpt,
        cover: charData.coverDataUrl || characters.find((c) => String(c.id) === String(characterId))?.cover || '',
        note: noteJson,
      };

      setCharacters((prev) => prev.map((c) => (String(c.id) === String(characterId) ? updatedChar : c)));
      setRaindropStatus('success');
      setRaindropMessage(`Updated character "${updatedChar.title}" in local session!`);

      try {
        const currentCache = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
        if (currentCache) {
          const parsed = JSON.parse(currentCache);
          const updatedChars = (parsed.characters || []).map((c: any) =>
            String(c.id) === String(characterId) ? updatedChar : c
          );
          localStorage.setItem(
            RAINDROP_CACHE_STORAGE_KEY,
            JSON.stringify({
              ...parsed,
              characters: updatedChars,
              timestamp: Date.now(),
            })
          );
        }
      } catch (e) {
        console.error('Failed to update cache:', e);
      }
    }
  };

  const handleDeleteCharacter = async (characterId: string | number) => {
    const isConnected = Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);
    const targetChar = characters.find((c) => String(c.id) === String(characterId));
    const charTitle = targetChar?.title || 'Character';

    const isRaindropId = typeof characterId === 'number' || /^\d+$/.test(String(characterId));

    if (isConnected && isRaindropId) {
      const query = settings.raindropToken && settings.raindropToken.trim()
        ? `?token=${encodeURIComponent(settings.raindropToken.trim())}`
        : '';
      const res = await fetch(`/api/raindrop/character/${characterId}${query}`, {
        method: 'DELETE',
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server endpoint error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || data.status !== 'success') {
        throw new Error(formatErrorMessage(data.message) || 'Failed to delete character from Raindrop');
      }

      setCharacters((prev) => prev.filter((c) => String(c.id) !== String(characterId)));
      setSelectedCharacterIds((prev) => prev.filter((id) => String(id) !== String(characterId)));
      setRaindropStatus('success');
      setRaindropMessage(`Deleted character "${charTitle}".`);

      await fetchRaindropData(settings.raindropToken);
      return;
    }

    setCharacters((prev) => prev.filter((c) => String(c.id) !== String(characterId)));
    setSelectedCharacterIds((prev) => prev.filter((id) => String(id) !== String(characterId)));
    setRaindropStatus('success');
    setRaindropMessage(`Deleted character "${charTitle}".`);

    try {
      const currentCache = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
      if (currentCache) {
        const parsed = JSON.parse(currentCache);
        const updatedChars = (parsed.characters || []).filter((c: any) => String(c.id) !== String(characterId));
        localStorage.setItem(
          RAINDROP_CACHE_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            characters: updatedChars,
            timestamp: Date.now(),
          })
        );
      }
    } catch (e) {
      console.error('Failed to update cache after delete:', e);
    }
  };

  const handleAddPreset = async (presetData: {
    title: string;
    prompt: string;
    previewImageFile?: File;
    previewImageDataUrl?: string;
    model?: string;
    aspectRatio?: string;
    textLanguage?: string;
    stylePackName?: string;
    characterNames?: string[];
  }) => {
    const isConnected = Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);

    if (isConnected) {
      const formData = new FormData();
      if (settings.raindropToken && settings.raindropToken.trim()) {
        formData.append('token', settings.raindropToken.trim());
      }
      formData.append('title', presetData.title);
      formData.append('prompt', presetData.prompt);
      if (presetData.model) formData.append('model', presetData.model);
      if (presetData.aspectRatio) formData.append('aspectRatio', presetData.aspectRatio);
      if (presetData.textLanguage) formData.append('textLanguage', presetData.textLanguage);
      if (presetData.stylePackName) formData.append('stylePackName', presetData.stylePackName);
      if (presetData.characterNames && presetData.characterNames.length > 0) {
        formData.append('characterNames', JSON.stringify(presetData.characterNames));
      }
      if (presetData.previewImageFile) {
        formData.append('imageFile', presetData.previewImageFile);
      } else if (presetData.previewImageDataUrl) {
        formData.append('cover', presetData.previewImageDataUrl);
      }

      const res = await fetch('/api/raindrop/preset', {
        method: 'POST',
        body: formData,
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server endpoint error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || data.status !== 'success') {
        throw new Error(formatErrorMessage(data.message) || 'Failed to save preset to Raindrop');
      }

      const newPreset: Preset = data.preset;
      setPresets((prev) => [newPreset, ...prev.filter((p) => String(p.id) !== String(newPreset.id))]);

      setRaindropStatus('success');
      setRaindropMessage(`Added preset "${newPreset.title}" to Raindrop Shower!`);

      await fetchRaindropData(settings.raindropToken);
    } else {
      const newPreset: Preset = {
        id: `preset-local-${Date.now()}`,
        title: presetData.title,
        prompt: presetData.prompt,
        preview_image: presetData.previewImageDataUrl || '',
        model: presetData.model,
        aspect_ratio: presetData.aspectRatio,
        text_language: presetData.textLanguage,
        style_pack_name: presetData.stylePackName,
        character_names: presetData.characterNames,
      };

      setPresets((prev) => [newPreset, ...prev]);
      setRaindropStatus('success');
      setRaindropMessage(`Added preset "${newPreset.title}" to local session!`);

      try {
        const currentCache = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
        const parsed = currentCache ? JSON.parse(currentCache) : {};
        localStorage.setItem(
          RAINDROP_CACHE_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            presets: [newPreset, ...(parsed.presets || [])],
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error('Failed to update cache:', e);
      }
    }
  };

  const handleDeletePreset = async (presetId: string | number) => {
    const isConnected = Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);
    const targetPreset = presets.find((p) => String(p.id) === String(presetId));
    const presetTitle = targetPreset?.title || 'Preset';

    const isRaindropId = typeof presetId === 'number' || /^\d+$/.test(String(presetId));

    if (isConnected && isRaindropId) {
      const query = settings.raindropToken && settings.raindropToken.trim()
        ? `?token=${encodeURIComponent(settings.raindropToken.trim())}`
        : '';
      const res = await fetch(`/api/raindrop/preset/${presetId}${query}`, {
        method: 'DELETE',
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error(`Server endpoint error (${res.status}): ${resText.slice(0, 150)}`);
      }

      if (!res.ok || data.status !== 'success') {
        throw new Error(formatErrorMessage(data.message) || 'Failed to delete preset from Raindrop');
      }

      setPresets((prev) => prev.filter((p) => String(p.id) !== String(presetId)));
      if (String(selectedPresetId) === String(presetId)) {
        setSelectedPresetId(null);
      }
      setRaindropStatus('success');
      setRaindropMessage(`Deleted preset "${presetTitle}".`);

      await fetchRaindropData(settings.raindropToken);
      return;
    }

    setPresets((prev) => prev.filter((p) => String(p.id) !== String(presetId)));
    if (String(selectedPresetId) === String(presetId)) {
      setSelectedPresetId(null);
    }
    setRaindropStatus('success');
    setRaindropMessage(`Deleted preset "${presetTitle}".`);

    try {
      const currentCache = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
      if (currentCache) {
        const parsed = JSON.parse(currentCache);
        const updatedPresets = (parsed.presets || []).filter((p: any) => String(p.id) !== String(presetId));
        localStorage.setItem(
          RAINDROP_CACHE_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            presets: updatedPresets,
            timestamp: Date.now(),
          })
        );
      }
    } catch (e) {
      console.error('Failed to update cache after delete preset:', e);
    }
  };

  const handleSelectStyle = (id: string | number | null) => {
    const isSelectingNewStyle = selectedStyleId !== id;
    setSelectedStyleId((prev) => (prev === id ? null : id));

    if (isSelectingNewStyle && id !== null) {
      setTimeout(() => {
        const section3 = document.getElementById('composition-section');
        if (section3) {
          const headerOffset = 80;
          const targetPosition = section3.getBoundingClientRect().top + window.pageYOffset - headerOffset;
          const startPosition = window.pageYOffset;
          const distance = targetPosition - startPosition;
          const duration = 550;
          let startTime: number | null = null;

          const animateScroll = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            window.scrollTo(0, startPosition + distance * ease);

            if (timeElapsed < duration) {
              requestAnimationFrame(animateScroll);
            }
          };

          requestAnimationFrame(animateScroll);
        }
      }, 50);
    }
  };

  const handleSelectPreset = (preset: Preset | null) => {
    if (!preset || String(selectedPresetId) === String(preset.id)) {
      setSelectedPresetId(null);
      return;
    }

    setSelectedPresetId(preset.id);

    // 1. Update Composition Prompt if preset has prompt
    if (preset.prompt) {
      setCompositionPrompt(preset.prompt);
    }

    // 2. Update Model if preset has model
    if (preset.model) {
      setModel(preset.model);
    }

    // 3. Update Aspect Ratio if preset has aspect_ratio
    if (preset.aspect_ratio) {
      setAspectRatio(preset.aspect_ratio);
    }

    // 4. Update Text Language if preset has text_language
    if (preset.text_language) {
      setTextLanguage(preset.text_language);
    }

    // 5. Match style pack if provided
    if (preset.style_pack_name) {
      const allAvailableStyles = [...styles, ...moreStyles];
      const targetStyleName = preset.style_pack_name.toLowerCase().trim();
      const matchedStyle = allAvailableStyles.find(
        (s) =>
          s.title &&
          (s.title.toLowerCase().trim() === targetStyleName ||
            s.title.toLowerCase().includes(targetStyleName) ||
            targetStyleName.includes(s.title.toLowerCase().trim()))
      );
      if (matchedStyle) {
        setSelectedStyleId(matchedStyle.id);
      }
    }

    // 6. Match characters if provided
    if (preset.character_names && preset.character_names.length > 0) {
      const matchedCharIds: (string | number)[] = [];
      preset.character_names.forEach((name) => {
        const cleanName = name.toLowerCase().trim();
        const matched = characters.find(
          (c) =>
            c.title &&
            (c.title.toLowerCase().trim() === cleanName ||
              c.title.toLowerCase().includes(cleanName) ||
              cleanName.includes(c.title.toLowerCase().trim()))
        );
        if (matched && !matchedCharIds.includes(matched.id)) {
          matchedCharIds.push(matched.id);
        }
      });
      if (matchedCharIds.length > 0) {
        setSelectedCharacterIds(matchedCharIds);
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      const existing = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        INPUTS_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          selectedPresetId,
          compositionPrompt,
          model,
          aspectRatio,
          textLanguage,
          selectedCharacterIds,
          selectedStyleId,
        })
      );
    } catch (e) {
      console.error('Failed to save selection to localStorage:', e);
    }
  }, [
    selectedPresetId,
    compositionPrompt,
    model,
    aspectRatio,
    textLanguage,
    selectedCharacterIds,
    selectedStyleId,
  ]);

  const handleResetAllInputs = () => {
    setSelectedPresetId(null);
    setCompositionPrompt('');
    setModel('GPT Image 2');
    setAspectRatio('Auto');
    setTextLanguage('Auto');
    setSelectedCharacterIds([]);
    setSelectedStyleId(null);
    try {
      localStorage.removeItem(INPUTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear inputs from localStorage:', e);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedCharacters = characters.filter((c) => selectedCharacterIds.includes(c.id));
  const selectedStyle = [...styles, ...moreStyles].find((s) => s.id === selectedStyleId) || null;
  const selectedPreset = presets.find((p) => String(p.id) === String(selectedPresetId)) || null;

  const hasToken = isMounted && Boolean((settings.raindropToken && settings.raindropToken.trim()) || hasEnvToken);

  if (!isMounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          onOpenSettings={() => {}}
          onRefreshRaindrop={() => {}}
          isFetchingRaindrop={false}
          raindropStatus="idle"
          hasRaindropToken={false}
        />
        <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 pb-24 flex items-center justify-center">
          <div className="min-h-[56vh] flex flex-col items-center justify-center gap-[22px] text-center">
            <div className="flex gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#C4633E] dark:bg-[#E07A52] animate-breathe" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#D9A06B] dark:bg-[#E6AF7E] animate-breathe [animation-delay:180ms]" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#7C8F6F] dark:bg-[#8FA87F] animate-breathe [animation-delay:360ms]" />
            </div>
            <div>
              <div className="font-serif text-[28px] text-[#2E2A26] dark:text-[#F5EFEA]">Warming up the studio</div>
              <p className="mt-2 text-[#8A7E73] dark:text-[#A69B90] text-[15px]">Reading your token and cached collections…</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefreshRaindrop={() => fetchRaindropData()}
        isFetchingRaindrop={isFetchingRaindrop}
        raindropStatus={raindropStatus}
        hasRaindropToken={hasToken}
        onResetAll={handleResetAllInputs}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 pb-24">
        {!hasToken ? (
          /* NOT CONNECTED */
          <div className="max-w-3xl mx-auto mt-3 sm:mt-10 animate-rise">
            <span className="inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-[#C4633E] dark:text-[#E07A52] bg-[#F7E7DC] dark:bg-[#2C1C14] px-3 py-1.5 rounded-full">
              Not connected
            </span>
            <h1 className="font-serif font-normal text-[34px] sm:text-[46px] lg:text-[54px] leading-[1.08] mt-4 -tracking-[0.5px] text-[#2E2A26] dark:text-[#F5EFEA]">
              Bring your cast and your
              <br />
              <em className="text-[#C4633E] dark:text-[#E07A52]">style packs</em> into one place.
            </h1>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#6E6459] dark:text-[#B0A498] max-w-[56ch]">
              Connect Raindrop and Shower Studio imports every character and style pack you&apos;ve saved.
              Pick who&apos;s in the shot, pick the look, describe the scene — and hand a clean,
              structured payload to your image app.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-5 mb-7">
              {['Characters, synced', 'Style packs, previewed', 'One-tap handoff'].map((chip) => (
                <span
                  key={chip}
                  className="px-3.5 py-1.5 rounded-full bg-[#FFFDFA] dark:bg-[#1C1916] border border-[#EAE0D4] dark:border-[#2E2924] text-[13.5px] text-[#6E6459] dark:text-[#B0A498]"
                >
                  {chip}
                </span>
              ))}
            </div>

            {raindropMessage && raindropStatus === 'error' && (
              <div className="mb-4 rounded-xl border border-[#F1D3C9] dark:border-[#4D2B1C] bg-[#FBEAE5] dark:bg-[#2C1C14] text-[#96402F] dark:text-[#F5AB88] text-sm px-4 py-3">
                {raindropMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              <div className="bg-[#FFFDFA] dark:bg-[#1C1916] border border-[#EAE0D4] dark:border-[#2E2924] rounded-[22px] p-6 shadow-[0_14px_34px_-22px_rgba(88,66,48,0.4)] dark:shadow-none flex flex-col">
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074]">
                  Recommended
                </div>
                <div className="font-serif text-[25px] mt-2 mb-1.5 text-[#2E2A26] dark:text-[#F5EFEA]">
                  Sign in with Raindrop
                </div>
                <p className="text-[14.5px] leading-[1.55] text-[#7A6F64] dark:text-[#A69B90] flex-1 mb-5">
                  A browser redirect grants access — nothing to copy or paste.
                </p>
                <button
                  id="oauth-login-main-btn"
                  onClick={handleOAuthLogin}
                  disabled={isLoggingInOAuth}
                  className="w-full flex items-center justify-center gap-2.5 px-[18px] py-3.5 rounded-2xl border-none bg-[#C4633E] dark:bg-[#E07A52] text-[#FFF7F1] dark:text-[#181411] text-[15px] font-medium cursor-pointer shadow-[0_10px_22px_-12px_rgba(196,99,62,0.9)] dark:shadow-none transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {isLoggingInOAuth ? (
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>{isLoggingInOAuth ? 'Connecting…' : 'Continue with Raindrop'}</span>
                </button>
              </div>

              <div className="border border-dashed border-[#DCCFBF] dark:border-[#3D352E] bg-[#FFFDFA]/40 dark:bg-[#1C1916]/40 rounded-[22px] p-6 flex flex-col">
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80] dark:text-[#8C8074]">
                  Alternative
                </div>
                <div className="font-serif text-[25px] mt-2 mb-1.5 text-[#2E2A26] dark:text-[#F5EFEA]">
                  Paste a token instead
                </div>
                <p className="text-[14.5px] leading-[1.55] text-[#7A6F64] dark:text-[#A69B90] flex-1 mb-5">
                  Already have a test token? Enter it by hand in Settings.
                </p>
                <button
                  id="placeholder-configure-token-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full px-[18px] py-3.5 rounded-2xl border border-[#D6C8B8] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[15px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52]"
                >
                  Open Settings →
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CONNECTED / WORKSPACE */
          <div className="flex flex-col gap-7 sm:gap-11">
            {/* Status Notification Banner */}
            {raindropMessage && (
              <div
                className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[14.5px] leading-[1.5] border ${
                  raindropStatus === 'success'
                    ? 'bg-[#EDF1E6] dark:bg-[#1E281C] text-[#4E6140] dark:text-[#8FA87F] border-[#DCE5CF] dark:border-[#2C3829]'
                    : 'bg-[#FBEAE5] dark:bg-[#2C1C14] text-[#96402F] dark:text-[#F5AB88] border-[#F1D3C9] dark:border-[#4D2B1C]'
                }`}
              >
                {raindropStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">{raindropMessage}</div>

                {raindropStatus !== 'success' && (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="shrink-0 px-3 py-1.5 rounded-full border border-current text-[13px] font-medium whitespace-nowrap cursor-pointer hover:opacity-80"
                  >
                    Fix in Settings
                  </button>
                )}
                <button
                  onClick={() => setRaindropMessage(null)}
                  className="shrink-0 opacity-50 hover:opacity-90 text-base leading-none px-1 cursor-pointer"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {/* Presets Section (First section) */}
            <PresetSelector
              presets={presets}
              selectedPresetId={selectedPresetId}
              presetCollectionId={presetsCollectionId}
              onSelectPreset={handleSelectPreset}
              isLoading={isFetchingRaindrop}
              onAddPreset={handleAddPreset}
              onDeletePreset={handleDeletePreset}
              availableCharacters={characters}
              availableStyles={[...styles, ...moreStyles]}
              currentWorkspaceValues={{
                prompt: compositionPrompt,
                model,
                aspectRatio,
                textLanguage,
                stylePackName: selectedStyle?.title,
                characterNames: selectedCharacters.map((c) => c.title),
              }}
              hasRaindropToken={hasToken}
              isAddModalOpen={isAddPresetModalOpen}
              onOpenAddModal={(vals) => {
                setPresetModalInitialValues(vals || null);
                setIsAddPresetModalOpen(true);
              }}
              onCloseAddModal={() => {
                setIsAddPresetModalOpen(false);
                setPresetModalInitialValues(null);
              }}
              initialModalValues={presetModalInitialValues}
            />

            {/* Section 1: Characters Selection */}
            <CharacterSelector
              characters={characters}
              selectedCharacterIds={selectedCharacterIds}
              onToggleCharacter={handleToggleCharacter}
              onSelectMultipleCharacters={handleSelectMultipleCharacters}
              onClearSelection={handleClearCharacters}
              isLoading={isFetchingRaindrop}
              onAddCharacter={handleAddCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              onUpdateCharacter={handleUpdateCharacter}
              hasRaindropToken={hasToken}
            />

            {/* Section 2: Styles Selection */}
            <StyleSelector
              styles={styles}
              selectedStyleId={selectedStyleId}
              onSelectStyle={handleSelectStyle}
              isLoading={isFetchingRaindrop}
            />

            {/* More Style Packs Section (Collapsed by default, caches without expiration) */}
            <MoreStyleSelector
              selectedStyleId={selectedStyleId}
              onSelectStyle={handleSelectStyle}
              raindropToken={settings.raindropToken}
              hasRaindropToken={hasToken}
              onStylesLoaded={(loadedStyles) => setMoreStyles(loadedStyles)}
            />

            {/* Section 3: Composition Controls */}
            <GeneratorControls
              selectedCharacters={selectedCharacters}
              selectedStyle={selectedStyle}
              selectedPreset={selectedPreset}
              compositionPrompt={compositionPrompt}
              onCompositionPromptChange={setCompositionPrompt}
              model={model}
              onModelChange={setModel}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              textLanguage={textLanguage}
              onTextLanguageChange={setTextLanguage}
              imageAppUrl={settings.imageAppUrl}
              raindropToken={settings.raindropToken}
              hasRaindropToken={hasToken}
              onResetAll={handleResetAllInputs}
              hasUploadCapability={settings.hasUploadCapability}
              onSaveAsPreset={handleSaveAsPreset}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-10 py-6 border-t border-[#EEE5D9] dark:border-[#2E2924] font-mono text-[11.5px] tracking-[0.04em] text-[#AB9E92] dark:text-[#80756B] transition-colors">
        Shower Studio — selections, prompts and sync data stay on this device.
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onTestRaindropSync={handleTestRaindropSync}
        isTestingSync={isTestingSync}
        syncTestMessage={syncTestMessage}
        hasEnvToken={hasEnvToken}
      />
    </div>
  );
}
