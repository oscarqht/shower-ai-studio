'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { CharacterSelector } from '@/components/CharacterSelector';
import { StyleSelector } from '@/components/StyleSelector';
import { GeneratorControls } from '@/components/GeneratorControls';
import { Character, StylePack, AppSettings, extractWorkflowId, composeWorkflowEndpoint, formatErrorMessage } from '@/types';
import { AlertTriangle, CheckCircle2, LogIn } from 'lucide-react';

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
    const noteObj = { tags: tagsNoteStr };
    const noteJson = JSON.stringify(noteObj);

    if (hasToken) {
      const formData = new FormData();
      formData.append('token', settings.raindropToken);
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
    const hasToken = Boolean(settings.raindropToken && settings.raindropToken.trim());
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

    if (hasToken && isRaindropId) {
      const formData = new FormData();
      formData.append('token', settings.raindropToken);
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

  const hasToken = isMounted && Boolean(settings.raindropToken && settings.raindropToken.trim());

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
              <span className="w-3.5 h-3.5 rounded-full bg-[#C4633E] animate-breathe" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#D9A06B] animate-breathe [animation-delay:180ms]" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#7C8F6F] animate-breathe [animation-delay:360ms]" />
            </div>
            <div>
              <div className="font-serif text-[28px] text-[#2E2A26]">Warming up the studio</div>
              <p className="mt-2 text-[#8A7E73] text-[15px]">Reading your token and cached collections…</p>
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
      />

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 pb-24">
        {!hasToken ? (
          /* NOT CONNECTED */
          <div className="max-w-3xl mx-auto mt-3 sm:mt-10 animate-rise">
            <span className="inline-block font-mono text-[11px] tracking-[0.16em] uppercase text-[#C4633E] bg-[#F7E7DC] px-3 py-1.5 rounded-full">
              Not connected
            </span>
            <h1 className="font-serif font-normal text-[34px] sm:text-[46px] lg:text-[54px] leading-[1.08] mt-4 -tracking-[0.5px] text-[#2E2A26]">
              Bring your cast and your
              <br />
              <em className="text-[#C4633E]">style packs</em> into one place.
            </h1>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#6E6459] max-w-[56ch]">
              Connect Raindrop and Shower Studio imports every character and style pack you&apos;ve saved.
              Pick who&apos;s in the shot, pick the look, describe the scene — and hand a clean,
              structured payload to your image app.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-5 mb-7">
              {['Characters, synced', 'Style packs, previewed', 'One-tap handoff'].map((chip) => (
                <span
                  key={chip}
                  className="px-3.5 py-1.5 rounded-full bg-[#FFFDFA] border border-[#EAE0D4] text-[13.5px] text-[#6E6459]"
                >
                  {chip}
                </span>
              ))}
            </div>

            {raindropMessage && raindropStatus === 'error' && (
              <div className="mb-4 rounded-xl border border-[#F1D3C9] bg-[#FBEAE5] text-[#96402F] text-sm px-4 py-3">
                {raindropMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              <div className="bg-[#FFFDFA] border border-[#EAE0D4] rounded-[22px] p-6 shadow-[0_14px_34px_-22px_rgba(88,66,48,0.4)] flex flex-col">
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80]">
                  Recommended
                </div>
                <div className="font-serif text-[25px] mt-2 mb-1.5 text-[#2E2A26]">
                  Sign in with Raindrop
                </div>
                <p className="text-[14.5px] leading-[1.55] text-[#7A6F64] flex-1 mb-5">
                  A browser redirect grants access — nothing to copy or paste.
                </p>
                <button
                  id="oauth-login-main-btn"
                  onClick={handleOAuthLogin}
                  disabled={isLoggingInOAuth}
                  className="w-full flex items-center justify-center gap-2.5 px-[18px] py-3.5 rounded-2xl border-none bg-[#C4633E] text-[#FFF7F1] text-[15px] font-medium cursor-pointer shadow-[0_10px_22px_-12px_rgba(196,99,62,0.9)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {isLoggingInOAuth ? (
                    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>{isLoggingInOAuth ? 'Connecting…' : 'Continue with Raindrop'}</span>
                </button>
              </div>

              <div className="border border-dashed border-[#DCCFBF] rounded-[22px] p-6 flex flex-col">
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#A08F80]">
                  Alternative
                </div>
                <div className="font-serif text-[25px] mt-2 mb-1.5 text-[#2E2A26]">
                  Paste a token instead
                </div>
                <p className="text-[14.5px] leading-[1.55] text-[#7A6F64] flex-1 mb-5">
                  Already have a test token? Enter it by hand in Settings.
                </p>
                <button
                  id="placeholder-configure-token-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full px-[18px] py-3.5 rounded-2xl border border-[#D6C8B8] bg-[#FFFDFA] text-[#5B5148] text-[15px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] hover:text-[#C4633E]"
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
                    ? 'bg-[#EDF1E6] text-[#4E6140] border-[#DCE5CF]'
                    : 'bg-[#FBEAE5] text-[#96402F] border-[#F1D3C9]'
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
                    className="shrink-0 px-3 py-1.5 rounded-full border border-current text-[13px] font-medium whitespace-nowrap"
                  >
                    Fix in Settings
                  </button>
                )}
                <button
                  onClick={() => setRaindropMessage(null)}
                  className="shrink-0 opacity-50 hover:opacity-90 text-base leading-none px-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

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

            {/* Section 3: Composition Controls */}
            <GeneratorControls
              selectedCharacters={selectedCharacters}
              selectedStyle={selectedStyle}
              imageAppUrl={settings.imageAppUrl}
              raindropToken={settings.raindropToken}
              onResetAll={handleResetAllInputs}
              hasUploadCapability={settings.hasUploadCapability}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-10 py-6 border-t border-[#EEE5D9] font-mono text-[11.5px] tracking-[0.04em] text-[#AB9E92]">
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
      />
    </div>
  );
}
