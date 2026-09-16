import { NextRequest, NextResponse } from 'next/server';

function getBearerToken(req: NextRequest, bodyToken?: string, envTokenName?: string): string {
  if (bodyToken && bodyToken.trim()) return bodyToken.trim();
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (envTokenName && process.env[envTokenName]) {
    return process.env[envTokenName]!.trim();
  }
  return '';
}

function formatErrorString(err: any): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    let msg = '';
    if (err.message && typeof err.message === 'string') {
      msg = err.code ? `[${err.code}] ${err.message}` : err.message;
    } else if (err.message) {
      msg = formatErrorString(err.message);
    } else if (err.error) {
      msg = formatErrorString(err.error);
    }
    if (msg) return msg;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const bodyFields: Record<string, any> = {};
    const attachedFiles: File[] = [];

    formData.forEach((value, key) => {
      if (value instanceof File) {
        attachedFiles.push(value);
      } else {
        if (bodyFields[key] !== undefined) {
          if (Array.isArray(bodyFields[key])) {
            bodyFields[key].push(value);
          } else {
            bodyFields[key] = [bodyFields[key], value];
          }
        } else {
          bodyFields[key] = value;
        }
      }
    });

    const customApiKey = bodyFields.uploadApiKey || bodyFields.apiKey;
    const apiKey = getBearerToken(req, customApiKey, 'IMAGE_API_KEY');
    const workflowId = bodyFields.uploadWorkflowId || bodyFields.workflowId || '';
    const origin = bodyFields.uploadOrigin || bodyFields.origin || 'https://ai.insea.io';

    if (!workflowId) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Upload Workflow ID is missing. Please check your Raindrop "Shower > Apps > Upload files" item link.',
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Upload Workflow API Key is missing. Please check your Raindrop "Shower > Apps > Upload files" item note field.',
        },
        { status: 400 }
      );
    }

    let targetOrigin = 'https://ai.insea.io';
    if (origin) {
      try {
        const cleanOrigin = origin.startsWith('http') ? origin : `https://${origin}`;
        targetOrigin = new URL(cleanOrigin).origin;
      } catch {
        // fallback
      }
    }

    const uploadEndpoint = `${targetOrigin}/api/workflows/${workflowId}/run`;

    const getArrayField = (fieldname: string): string[] => {
      const val = bodyFields[fieldname];
      if (!val) return [];
      if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      } catch {
        // not JSON
      }
      return [String(val)].filter(Boolean);
    };

    const compositionUrls = getArrayField('compositionReferenceLinks');
    const characterUrls = getArrayField('characterReferenceLinks').concat(getArrayField('charactersReferenceLinks'));
    const styleUrls = getArrayField('styleReferenceLinks');

    const filesToUpload: Array<{ buffer: Buffer; filename: string; mimetype: string; category: 'composition' | 'character' | 'style' }> = [];

    for (const file of attachedFiles) {
      const arrayBuf = await file.arrayBuffer();
      filesToUpload.push({
        buffer: Buffer.from(arrayBuf),
        filename: file.name || 'composition.png',
        mimetype: file.type || 'image/png',
        category: 'composition',
      });
    }

    async function fetchImageBuffer(url: string, defaultName: string): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
      let rawUrl = url.trim();
      if (!rawUrl) {
        return { buffer: FALLBACK_PNG, filename: defaultName, mimetype: 'image/png' };
      }

      let targetUrl = rawUrl;
      if (rawUrl.includes('rdl.ink/render/')) {
        try {
          const match = rawUrl.match(/rdl\.ink\/render\/(https?(?:%3A%2F%2F|:\/\/)[^\s?#]+)/i);
          if (match && match[1]) {
            const decoded = decodeURIComponent(match[1]);
            if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
              targetUrl = decoded;
            }
          }
        } catch {
          // ignore
        }
      }

      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*',
      };

      const raindropToken = bodyFields.raindropToken || getBearerToken(req, undefined, 'RAINDROP_TOKEN');
      if (raindropToken && (targetUrl.includes('raindrop.io') || targetUrl.includes('rdl.ink'))) {
        reqHeaders['Authorization'] = `Bearer ${raindropToken}`;
      }

      const urlsToTry = [targetUrl];
      if (rawUrl !== targetUrl && rawUrl.startsWith('http')) {
        urlsToTry.push(rawUrl);
      }

      for (const attemptUrl of urlsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const resp = await fetch(attemptUrl, {
              headers: reqHeaders,
              signal: controller.signal,
            });
            if (resp.ok) {
              const mimetype = resp.headers.get('content-type') || 'image/jpeg';
              const arrayBuf = await resp.arrayBuffer();
              let filename = defaultName;
              try {
                const parsed = new URL(attemptUrl);
                const basename = parsed.pathname.split('/').pop();
                if (basename && basename.includes('.')) {
                  filename = basename;
                }
              } catch {
                // fallback
              }
              clearTimeout(timeout);
              return { buffer: Buffer.from(arrayBuf), filename, mimetype };
            }
          } catch (e: any) {
            console.warn(`Attempt ${attempt} failed for ${attemptUrl}:`, e?.message);
          } finally {
            clearTimeout(timeout);
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }

      return { buffer: FALLBACK_PNG, filename: defaultName, mimetype: 'image/png' };
    }

    const [compItems, charItems, styleItems] = await Promise.all([
      Promise.all(compositionUrls.map((url, i) => fetchImageBuffer(url, `composition-ref-${i + 1}.jpg`))),
      Promise.all(characterUrls.map((url, i) => fetchImageBuffer(url, `character-ref-${i + 1}.jpg`))),
      Promise.all(styleUrls.map((url, i) => fetchImageBuffer(url, `style-ref-${i + 1}.jpg`))),
    ]);

    for (const item of compItems) {
      filesToUpload.push({ ...item, category: 'composition' });
    }
    const N_comp = filesToUpload.length;

    for (const item of charItems) {
      filesToUpload.push({ ...item, category: 'character' });
    }
    const N_char = filesToUpload.length - N_comp;

    for (const item of styleItems) {
      filesToUpload.push({ ...item, category: 'style' });
    }
    const N_style = filesToUpload.length - N_comp - N_char;

    if (filesToUpload.length === 0) {
      return NextResponse.json({
        status: 'success',
        composition_reference_file_ids: [],
        characters_reference_file_ids: [],
        style_reference_file_ids: [],
        all_file_ids: [],
      });
    }

    const upstreamFormData = new FormData();
    for (const fileItem of filesToUpload) {
      const uint8Array = new Uint8Array(fileItem.buffer);
      const fileObj = new File([uint8Array], fileItem.filename, { type: fileItem.mimetype });
      upstreamFormData.append('files', fileObj);
    }

    let upstreamRes: Response;
    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 90000);

    try {
      upstreamRes = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: upstreamFormData,
        signal: uploadController.signal,
      });
    } catch (fetchErr: any) {
      const errMsg = formatErrorString(fetchErr);
      return NextResponse.json(
        {
          status: 'error',
          message: `Failed to connect to Upload Workflow endpoint (${uploadEndpoint}): ${errMsg}`,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(uploadTimeout);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    let upstreamData: any = {};
    if (contentType.includes('application/json')) {
      try {
        upstreamData = await upstreamRes.json();
      } catch {
        upstreamData = { rawText: 'Invalid JSON response from upstream' };
      }
    } else {
      const text = await upstreamRes.text();
      upstreamData = { rawText: text };
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: formatErrorString(
            upstreamData?.message ||
              upstreamData?.error ||
              upstreamData?.data?.error ||
              `Upload files request failed (${upstreamRes.status})`
          ),
          upstreamData,
        },
        { status: upstreamRes.status }
      );
    }

    const rawFileIds: any =
      upstreamData?.data?.outputs?.file_ids ||
      upstreamData?.outputs?.file_ids ||
      upstreamData?.data?.file_ids ||
      upstreamData?.file_ids ||
      [];

    const allFileIds: string[] = Array.isArray(rawFileIds) ? rawFileIds.map((v: any) => String(v)) : [];

    const composition_reference_file_ids = allFileIds.slice(0, N_comp);
    const characters_reference_file_ids = allFileIds.slice(N_comp, N_comp + N_char);
    const style_reference_file_ids = allFileIds.slice(N_comp + N_char, N_comp + N_char + N_style);

    return NextResponse.json({
      status: 'success',
      data: {
        outputs: {
          file_ids: allFileIds,
        },
      },
      composition_reference_file_ids,
      characters_reference_file_ids,
      style_reference_file_ids,
      all_file_ids: allFileIds,
      upstreamData,
    });
  } catch (err: any) {
    console.error('Error in /api/workflows/batch-upload:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: formatErrorString(err) || 'Failed to upload files to Upload Workflow',
      },
      { status: 500 }
    );
  }
}
