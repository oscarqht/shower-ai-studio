export interface Character {
  id: string | number;
  title: string;
  excerpt: string;
  cover: string;
  link?: string;
  note?: string;
  index?: number;
}

export interface StylePack {
  id: string | number;
  title: string;
  style_prompt_raindrop_id?: string | number;
  style_prompt: string;
  extra_style_instruction: string;
  preview_cover: string;
  style_reference_links: string[];
}

export interface Preset {
  id: string | number;
  collection_id?: string | number;
  title: string;
  preview_image: string;
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  text_language?: string;
  style_pack_name?: string;
  character_names?: string[];
  raw_note?: string;
}

export interface PresetModalInitialValues {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  textLanguage?: string;
  stylePackName?: string;
  characterNames?: string[];
}

export interface WorkflowInfo {
  workflowId: string;
  origin: string;
  url?: string;
  apiKey?: string;
  endpoint?: string;
}

export interface RaindropFetchResult {
  characters: Character[];
  styles: StylePack[];
  presets?: Preset[];
  presetsCollectionId?: string | number;
  imageAppUrl?: string;
  hasUploadCapability?: boolean;
  status: 'success' | 'partial' | 'error' | 'demo';
  message?: string;
  debugInfo?: any;
}

export interface ImageGenerationParams {
  model: string;
  composition_prompt: string;
  composition_references: string[];
  composition_reference_file_ids?: string[];
  composition_reference_links: string[];
  characters_prompt: string;
  characters_references: string[];
  character_reference_links: string[];
  characters_reference_links?: string[];
  style_prompt_raindrop_id: string;
  style_prompt?: string;
  extra_style_instruction?: string;
  style_references: string[];
  style_reference_links: string[];
  aspect_ratio: string;
  text_language: string;
  compositionFiles?: File[];
}

export interface ApiDebugInfo {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  requestPayload: ImageGenerationParams;
  statusCode?: number;
  rawResponse?: any;
  error?: string;
}

export interface GenerationResult {
  id: string;
  timestamp: number;
  imageUrl?: string;
  images?: string[];
  params: ImageGenerationParams;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  rawResponse?: any;
  debugInfo?: ApiDebugInfo;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  raindropToken: string;
  raindropRefreshToken?: string;
  raindropExpiresAt?: number;
  imageAppUrl?: string;
  hasUploadCapability?: boolean;
  imageApiKey?: string;
  imageWorkflowId?: string;
  imageApiEndpoint?: string;
  uploadApiKey?: string;
  uploadWorkflowId?: string;
  uploadWorkflowOrigin?: string;
  uploadApiEndpoint?: string;
}

export const DEFAULT_WORKFLOW_ID = '';

export function extractWorkflowId(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const workflowMatch = trimmed.match(/workflows\/(\d+)/i);
  if (workflowMatch) return workflowMatch[1];
  try {
    const parsed = new URL(trimmed);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    for (const seg of pathSegments) {
      if (/^\d+$/.test(seg)) {
        return seg;
      }
    }
  } catch {
    // Ignore URL parsing errors if raw string is not a full URL
  }
  const digitMatch = trimmed.match(/(\d+)/);
  return digitMatch ? digitMatch[1] : trimmed;
}

export function composeWorkflowEndpoint(workflowId?: string, rawUrlOrOrigin?: string): string {
  const cleanId = workflowId ? workflowId.trim() : '';
  if (!cleanId) return '';

  let origin = 'https://ai.insea.io';
  if (rawUrlOrOrigin && rawUrlOrOrigin.trim()) {
    const raw = rawUrlOrOrigin.trim();
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const parsed = new URL(raw);
        origin = parsed.origin;
      } else {
        origin = raw.replace(/\/+$/, '');
      }
    } catch {
      // fallback
    }
  }

  return `${origin}/api/workflows/${cleanId}/run`;
}

export function formatErrorMessage(err: any): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    if (err.message) {
      if (typeof err.message === 'string') {
        return err.code ? `[${err.code}] ${err.message}` : err.message;
      }
      return formatErrorMessage(err.message);
    }
    if (err.error) {
      return formatErrorMessage(err.error);
    }
    if (err.detail && typeof err.detail === 'string') {
      return err.detail;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

