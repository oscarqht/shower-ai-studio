'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { CharacterSelector } from '@/components/CharacterSelector';
import { StyleSelector } from '@/components/StyleSelector';
import { GeneratorControls } from '@/components/GeneratorControls';
import { Character, StylePack, AppSettings, extractWorkflowId, composeWorkflowEndpoint, formatErrorMessage } from '@/types';
import { AlertTriangle, Sparkles, Key, Settings, CheckCircle2, LogIn } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'raindrop_ai_studio_settings_v1';
const INPUTS_STORAGE_KEY = 'raindrop_ai_studio_last_inputs_v1';
const RAINDROP_CACHE_STORAGE_KEY = 'raindrop_ai_studio_cache_v1';

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

  // Raindrop Data States
  const [characters, setCharacters] = useState<Character[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.characters)) {
          return parsed.characters;
        }
      }
    } catch (e) {
      console.error('Failed to load cached characters from localStorage:', e);
    }
    return [];
  });

  const [styles, setStyles] = useState<StylePack[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.styles)) {
          return parsed.styles;
        }
      }
    } catch (e) {
      console.error('Failed to load cached styles from localStorage:', e);
    }
    return [];
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
  const [isFetchingRaindrop, setIsFetchingRaindrop] = useState(false);
  const [raindropStatus, setRaindropStatus] = useState<'success' | 'partial' | 'error' | 'idle'>('idle');
  const [raindropMessage, setRaindropMessage] = useState<string | null>(null);

  // Modals & OAuth States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncTestMessage, setSyncTestMessage] = useState<string | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [isLoggingInOAuth, setIsLoggingInOAuth] = useState(false);

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
      const hasCache = Boolean(localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY));
      if (!hasCache && characters.length === 0 && styles.length === 0) {
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

      if (!activeToken || !activeToken.trim()) {
        setRaindropStatus('error');
        setRaindropMessage('Raindrop API Token is missing. Click Settings to enter your token.');
        setIsFetchingRaindrop(false);
        return;
      }

      try {
        const res = await fetch('/api/raindrop/fetch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: activeToken }),
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
          const newImageAppUrl = data.imageAppUrl || '';

          setCharacters(newChars);
          setStyles(newStyles);
          if (newImageAppUrl) {
            setSettings((prev) => {
              const updated = { ...prev, imageAppUrl: newImageAppUrl };
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
            `Successfully fetched ${newChars.length} characters and ${newStyles.length} style packs from Raindrop Shower!`
          );

          try {
            localStorage.setItem(
              RAINDROP_CACHE_STORAGE_KEY,
              JSON.stringify({
                characters: newChars,
                styles: newStyles,
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
    [settings.raindropToken, settings.raindropRefreshToken, refreshRaindropToken]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
        setSettings(loadedSettings);
        if (loadedSettings.raindropToken && loadedSettings.raindropToken.trim()) {
          const hasCache = Boolean(localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY));
          if (!hasCache && characters.length === 0 && styles.length === 0) {
            fetchRaindropData(loadedSettings.raindropToken);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load settings on mount:', e);
    }

    const hasCache = Boolean(localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY));
    if (hasCache && (characters.length > 0 || styles.length > 0)) {
      setRaindropStatus('success');
      setRaindropMessage(`Loaded ${characters.length} characters and ${styles.length} style packs from local cache.`);
    }

    setIsMounted(true);
  }, []);

  const handleTestRaindropSync = async (tokenToTest: string) => {
    setIsTestingSync(true);
    setSyncTestMessage(null);
    try {
      const res = await fetch('/api/raindrop/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSyncTestMessage(`Success! Found ${data.characters?.length || 0} characters and ${data.styles?.length || 0} style packs.`);
        handleSaveSettings({
          ...settings,
          raindropToken: tokenToTest,
        });
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
    const hasToken = Boolean(settings.raindropToken && settings.raindropToken.trim());
    const tagsNoteStr = charData.tags.join(', ');

    if (hasToken) {
      const formData = new FormData();
      formData.append('token', settings.raindropToken);
      formData.append('title', charData.title);
      formData.append('excerpt', charData.excerpt);
      formData.append('note', tagsNoteStr);
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
        note: tagsNoteStr,
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
    const hasToken = Boolean(settings.raindropToken && settings.raindropToken.trim());
    const isRaindropId = typeof characterId === 'number' || /^\d+$/.test(String(characterId));
    const tagsNoteStr = charData.tags.join(', ');

    if (hasToken && isRaindropId) {
      const formData = new FormData();
      formData.append('token', settings.raindropToken);
      formData.append('title', charData.title);
      formData.append('excerpt', charData.excerpt);
      formData.append('note', tagsNoteStr);
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
        note: tagsNoteStr,
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
    const hasToken = Boolean(settings.raindropToken && settings.raindropToken.trim());
    const targetChar = characters.find((c) => String(c.id) === String(characterId));
    const charTitle = targetChar?.title || 'Character';

    const isRaindropId = typeof characterId === 'number' || /^\d+$/.test(String(characterId));

    if (hasToken && isRaindropId) {
      const res = await fetch(`/api/raindrop/character/${characterId}?token=${encodeURIComponent(settings.raindropToken)}`, {
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(INPUTS_STORAGE_KEY);
      const existing = saved ? JSON.parse(saved) : {};
      localStorage.setItem(
        INPUTS_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          selectedCharacterIds,
          selectedStyleId,
        })
      );
    } catch (e) {
      console.error('Failed to save selection to localStorage:', e);
    }
  }, [selectedCharacterIds, selectedStyleId]);

  const handleResetAllInputs = () => {
    setSelectedCharacterIds([]);
    setSelectedStyleId(null);
    try {
      localStorage.removeItem(INPUTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear inputs from localStorage:', e);
    }
  };

  const selectedCharacters = characters.filter((c) => selectedCharacterIds.includes(c.id));
  const selectedStyle = styles.find((s) => s.id === selectedStyleId) || null;

  return (
    <div className="min-h-screen bg-base-300 text-base-content font-sans flex flex-col">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefreshRaindrop={() => fetchRaindropData()}
        isFetchingRaindrop={isFetchingRaindrop}
        raindropStatus={raindropStatus}
        hasRaindropToken={Boolean(settings.raindropToken && settings.raindropToken.trim())}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 flex flex-col justify-center">
        {!isMounted ? (
          /* State 1: Loading screen while determining token presence */
          <div className="my-auto py-16 flex flex-col items-center justify-center text-center">
            <div className="card bg-base-100 border border-base-300 rounded-3xl p-8 sm:p-10 shadow-xl max-w-md w-full flex flex-col items-center justify-center gap-4">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <div>
                <h3 className="text-sm font-bold text-base-content">Initializing Shower Studio...</h3>
                <p className="text-xs text-base-content/60 mt-1">Reading token &amp; loading cached collections</p>
              </div>
            </div>
          </div>
        ) : settings.raindropToken?.trim() ? (
          /* State 2: Has token -> Show main UI */
          <div className="space-y-6">
            {/* Status Notification Banner */}
            {raindropMessage && (
              <div
                className={`alert ${
                  raindropStatus === 'success' ? 'alert-success' : 'alert-error'
                } rounded-2xl p-4 text-xs shadow-sm flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-2.5">
                  {raindropStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{raindropMessage}</span>
                </div>

                {raindropStatus !== 'success' && (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="btn btn-xs btn-outline"
                  >
                    Configure Settings
                  </button>
                )}
              </div>
            )}

            {/* Panels in Single Column Stack */}
            <div className="flex flex-col gap-6">
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
                hasRaindropToken={Boolean(settings.raindropToken && settings.raindropToken.trim())}
              />

              {/* Section 2: Styles Selection */}
              <StyleSelector
                styles={styles}
                selectedStyleId={selectedStyleId}
                onSelectStyle={handleSelectStyle}
                isLoading={isFetchingRaindrop}
              />

              {/* Section 3: Composition Controls */}
              <GeneratorControls
                selectedCharacters={selectedCharacters}
                selectedStyle={selectedStyle}
                imageAppUrl={settings.imageAppUrl}
                raindropToken={settings.raindropToken}
                onResetAll={handleResetAllInputs}
              />
            </div>
          </div>
        ) : (
          /* State 3: Otherwise (No token) -> Show "Raindrop API Bearer Token Required" UI */
          <div className="my-auto py-8 flex flex-col items-center justify-center text-center">
            <div className="card bg-base-100 border border-base-300 rounded-3xl p-8 sm:p-12 shadow-xl w-full max-w-2xl text-center relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-5 border border-primary/20 shadow-inner">
                  <Key className="w-8 h-8" />
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-base-content mb-2.5">
                  Raindrop API Bearer Token Required
                </h2>

                <p className="text-xs sm:text-sm text-base-content/70 max-w-md mb-8 leading-relaxed">
                  Please configure your Raindrop API Bearer Token in Settings to load characters and style packs.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mb-8">
                  <button
                    id="oauth-login-main-btn"
                    onClick={handleOAuthLogin}
                    disabled={isLoggingInOAuth}
                    className="btn btn-primary gap-2 shadow-lg shadow-primary/30 w-full sm:w-auto"
                  >
                    {isLoggingInOAuth ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Login with Raindrop (OAuth2)
                      </>
                    )}
                  </button>
                  <button
                    id="placeholder-configure-token-btn"
                    onClick={() => setIsSettingsOpen(true)}
                    className="btn btn-outline border-base-300 gap-2 w-full sm:w-auto"
                  >
                    <Settings className="w-4 h-4" />
                    Manual Token
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10 pt-8 border-t border-base-200 text-left w-full">
                  <div className="p-3.5 bg-base-200/50 rounded-xl border border-base-300">
                    <div className="text-xs font-semibold text-base-content flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      1. Characters
                    </div>
                    <p className="text-[11px] text-base-content/60">
                      Import reference characters &amp; tags from Raindrop Shower.
                    </p>
                  </div>

                  <div className="p-3.5 bg-base-200/50 rounded-xl border border-base-300">
                    <div className="text-xs font-semibold text-base-content flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-secondary" />
                      2. Style Packs
                    </div>
                    <p className="text-[11px] text-base-content/60">
                      Sync aesthetic prompts &amp; style collections instantly.
                    </p>
                  </div>

                  <div className="p-3.5 bg-base-200/50 rounded-xl border border-base-300">
                    <div className="text-xs font-semibold text-base-content flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      3. Payload
                    </div>
                    <p className="text-[11px] text-base-content/60">
                      Inspect structured generation parameters &amp; payload JSON.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-base-300 bg-base-100 py-4 px-4 text-center text-xs text-base-content/60 transition-colors">
        <p>Raindrop Shower Studio • Next.js + TailwindCSS + daisyUI Migration</p>
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
      />
    </div>
  );
}
