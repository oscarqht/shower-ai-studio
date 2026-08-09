import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { CharacterSelector } from './components/CharacterSelector';
import { StyleSelector } from './components/StyleSelector';
import { GeneratorControls } from './components/GeneratorControls';
import { Character, StylePack, RaindropFetchResult, AppSettings, extractWorkflowId, composeWorkflowEndpoint, formatErrorMessage } from './types';
import { AlertTriangle, Sparkles, RefreshCw, CheckCircle2, Info, Key, Settings, ShieldAlert } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'raindrop_ai_studio_settings_v1';
const INPUTS_STORAGE_KEY = 'raindrop_ai_studio_last_inputs_v1';
const RAINDROP_CACHE_STORAGE_KEY = 'raindrop_ai_studio_cache_v1';
const THEME_STORAGE_KEY = 'raindrop_ai_studio_theme_v1';

export default function App() {
  // Always follow current OS theme
  useEffect(() => {
    const applyTheme = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => applyTheme();

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
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

  // Raindrop Data States - initialized from localStorage cache if present
  const [characters, setCharacters] = useState<Character[]>(() => {
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

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncTestMessage, setSyncTestMessage] = useState<string | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);

  // Save settings helper
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    // Only fetch automatically if cache is empty
    if (newSettings.raindropToken && newSettings.raindropToken.trim()) {
      const hasCache = Boolean(localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY));
      if (!hasCache && characters.length === 0 && styles.length === 0) {
        fetchRaindropData(newSettings.raindropToken);
      }
    }
  };

  // Raindrop Fetch Function
  const fetchRaindropData = useCallback(
    async (tokenToUse?: string) => {
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

        const data = await res.json();

        if (res.ok && data.status === 'success') {
          const newChars = data.characters || [];
          const newStyles = data.styles || [];
          const newImageAppUrl = data.imageAppUrl || '';

          // Update UI state
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

          // Update localStorage cache
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
    [settings.raindropToken]
  );

  // Mount effect: read from cache if available; only fetch if cache is missing and token is present
  useEffect(() => {
    const hasCache = Boolean(localStorage.getItem(RAINDROP_CACHE_STORAGE_KEY));
    if (hasCache && (characters.length > 0 || styles.length > 0)) {
      setRaindropStatus('success');
      setRaindropMessage(`Loaded ${characters.length} characters and ${styles.length} style packs from local cache.`);
    } else if (settings.raindropToken && settings.raindropToken.trim()) {
      fetchRaindropData();
    }
  }, []);

  // Test Raindrop token handler inside settings modal
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

  // Character Toggle (Zero or More)
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

  // Add Character Handler (saves to Raindrop API or local session)
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

      // Refresh Raindrop collection data to ensure full sync of cover image & tags from Raindrop
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

  // Update Character Handler (updates Raindrop API or local session)
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

      const res = await fetch(`/api/raindrop/character/${characterId}/update`, {
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

      // Refresh Raindrop collection data to ensure full sync
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

  // Delete Character Handler (deletes from Raindrop API or local session)
  const handleDeleteCharacter = async (characterId: string | number) => {
    const hasToken = Boolean(settings.raindropToken && settings.raindropToken.trim());
    const targetChar = characters.find((c) => String(c.id) === String(characterId));
    const charTitle = targetChar?.title || 'Character';

    const isRaindropId = typeof characterId === 'number' || /^\d+$/.test(String(characterId));

    if (hasToken && isRaindropId) {
      const res = await fetch(`/api/raindrop/character/${characterId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.raindropToken }),
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

  // Style Select (Zero or One)
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
          const duration = 550; // ms duration for ultra smooth transition
          let startTime: number | null = null;

          const animateScroll = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            // Ease-in-out cubic easing for fluid natural motion
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

  // Persist selections to localStorage
  useEffect(() => {
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

  // Reset all user inputs handler
  const handleResetAllInputs = () => {
    setSelectedCharacterIds([]);
    setSelectedStyleId(null);
    try {
      localStorage.removeItem(INPUTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear inputs from localStorage:', e);
    }
  };

  // Get selected objects
  const selectedCharacters = characters.filter((c) => selectedCharacterIds.includes(c.id));
  const selectedStyle = styles.find((s) => s.id === selectedStyleId) || null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-200">
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
        {!settings.raindropToken?.trim() ? (
          /* Placeholder view when Raindrop API token is missing */
          <div className="my-auto py-8 flex flex-col items-center justify-center text-center">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-xl w-full max-w-2xl text-center relative overflow-hidden transition-colors">
              {/* Subtle background glow effects */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-5 border border-indigo-200 dark:border-indigo-500/20 shadow-inner">
                  <Key className="w-8 h-8" />
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2.5">
                  Raindrop API Bearer Token Required
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mb-8 leading-relaxed">
                  Please configure your Raindrop API Bearer Token in Settings to load characters and style packs.
                </p>

                <button
                  id="placeholder-configure-token-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  className="font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Settings className="w-4 h-4" />
                  Configure Token Now
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 text-left w-full">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      1. Characters
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Import reference characters &amp; tags from Raindrop Shower.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      2. Style Packs
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sync aesthetic prompts &amp; style collections instantly.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      3. Payload
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inspect structured generation parameters &amp; payload JSON.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Normal workspace views when token is provided */
          <div className="space-y-6">
            {/* Status Notification Banner */}
            {raindropMessage && (
              <div
                className={`rounded-2xl p-4 border flex items-start sm:items-center justify-between gap-3 text-xs shadow-sm transition ${
                  raindropStatus === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {raindropStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{raindropMessage}</span>
                </div>

                {raindropStatus !== 'success' && (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="shrink-0 font-semibold underline hover:no-underline underline-offset-2 ml-2"
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
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <p>Raindrop Shower Studio • AI Image Generation Workflow API Integration</p>
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
