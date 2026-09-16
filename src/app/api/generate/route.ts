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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const bodyFields: Record<string, any> = {};
    const attachedFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
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
    } else {
      try {
        const body = await req.json();
        Object.assign(bodyFields, body);
      } catch {
        // ignore
      }
    }

    const customApiKey = bodyFields.apiKey;
    const apiEndpoint = bodyFields.apiEndpoint;
    const apiKey = getBearerToken(req, customApiKey, 'IMAGE_API_KEY');
    const targetEndpoint =
      (apiEndpoint && typeof apiEndpoint === 'string' && apiEndpoint.trim()) ||
      process.env.IMAGE_API_ENDPOINT ||
      '';

    if (!targetEndpoint) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Image Generation Workflow / App ID endpoint is missing. Please enter your App ID in Settings.',
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Image Processing API Key is missing. Please open Settings and configure your API key before generating.',
        },
        { status: 400 }
      );
    }

    const getArrayField = (fieldname: string): string[] => {
      const val = bodyFields[fieldname];
      if (!val) return [];
      if (Array.isArray(val)) return val.map((v) => String(v));
      return [String(val)];
    };

    const model = bodyFields.model || 'GPT Image 2';
    const aspect_ratio = bodyFields.aspect_ratio || 'Auto';
    const text_language = bodyFields.text_language || 'Auto';
    const composition_prompt = bodyFields.composition_prompt || '';
    const composition_reference_file_ids = getArrayField('composition_reference_file_ids');
    const composition_reference_links = getArrayField('composition_reference_links');
    const characters_prompt = bodyFields.characters_prompt || '';
    const characters_reference_links = getArrayField('characters_reference_links').concat(getArrayField('character_reference_links'));
    const style_prompt_raindrop_id = bodyFields.style_prompt_raindrop_id || '';
    const style_reference_links = getArrayField('style_reference_links');

    const upstreamFormData = new FormData();
    upstreamFormData.append('model', model);
    upstreamFormData.append('aspect_ratio', aspect_ratio);
    upstreamFormData.append('text_language', text_language);
    upstreamFormData.append('composition_prompt', composition_prompt);

    for (const fileId of composition_reference_file_ids) {
      upstreamFormData.append('composition_reference_file_ids', fileId);
    }

    for (const file of attachedFiles) {
      upstreamFormData.append('composition_reference_file_ids', file);
    }

    for (const link of composition_reference_links) {
      upstreamFormData.append('composition_reference_links', link);
    }

    upstreamFormData.append('characters_prompt', characters_prompt);

    for (const link of characters_reference_links) {
      upstreamFormData.append('characters_reference_links', link);
    }

    upstreamFormData.append('style_prompt_raindrop_id', style_prompt_raindrop_id);

    for (const link of style_reference_links) {
      upstreamFormData.append('style_reference_links', link);
    }

    const payloadDebug = {
      model,
      aspect_ratio,
      text_language,
      composition_prompt,
      composition_reference_file_ids,
      composition_reference_links,
      characters_prompt,
      characters_reference_links,
      style_prompt_raindrop_id,
      style_reference_links,
    };

    const upstreamRes = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamFormData,
    });

    const resContentType = upstreamRes.headers.get('content-type') || '';
    let upstreamData: any;

    if (resContentType.includes('application/json')) {
      upstreamData = await upstreamRes.json();
    } else {
      const text = await upstreamRes.text();
      upstreamData = { rawText: text };
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          status: 'error',
          endpoint: targetEndpoint,
          requestPayload: payloadDebug,
          statusCode: upstreamRes.status,
          message: formatErrorString(
            upstreamData?.message ||
              upstreamData?.error ||
              upstreamData?.data?.error ||
              upstreamData ||
              `Image Generation API error (${upstreamRes.status})`
          ),
          upstreamData,
        },
        { status: upstreamRes.status }
      );
    }

    let targetOrigin = 'https://ai.insea.io';
    if (targetEndpoint) {
      try {
        targetOrigin = new URL(targetEndpoint).origin;
      } catch {
        // fallback
      }
    }

    let fileId: string | null = null;
    let directImageUrl: string | null = null;

    const imgOutput =
      upstreamData?.data?.outputs?.image ??
      upstreamData?.outputs?.image ??
      upstreamData?.data?.image ??
      upstreamData?.image;

    if (imgOutput) {
      if (typeof imgOutput === 'string') {
        if (imgOutput.startsWith('http://') || imgOutput.startsWith('https://') || imgOutput.startsWith('data:')) {
          directImageUrl = imgOutput;
        } else {
          fileId = imgOutput;
        }
      } else if (typeof imgOutput === 'object' && imgOutput !== null) {
        if (imgOutput.id) fileId = String(imgOutput.id);
        else if (imgOutput.file_id) fileId = String(imgOutput.file_id);

        if (imgOutput.url) directImageUrl = String(imgOutput.url);
        else if (imgOutput.file_url) directImageUrl = String(imgOutput.file_url);
        else if (imgOutput.link) directImageUrl = String(imgOutput.link);
        else if (imgOutput.src) directImageUrl = String(imgOutput.src);
      }
    }

    if (!fileId && !directImageUrl) {
      fileId = upstreamData?.data?.file_id || upstreamData?.file_id || null;
    }

    if (
      directImageUrl &&
      !directImageUrl.startsWith('http://') &&
      !directImageUrl.startsWith('https://') &&
      !directImageUrl.startsWith('data:')
    ) {
      directImageUrl = directImageUrl.startsWith('/') ? `${targetOrigin}${directImageUrl}` : `${targetOrigin}/${directImageUrl}`;
    }

    let generatedImageUrl: string | null = directImageUrl;

    if (fileId && !generatedImageUrl) {
      try {
        const fileApiUrl = `${targetOrigin}/api/files/${fileId}`;

        const fileRes = await fetch(fileApiUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (fileRes.ok) {
          const mimeType = fileRes.headers.get('content-type') || 'image/png';
          const arrayBuffer = await fileRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          generatedImageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } else {
          if (fileId.startsWith('http://') || fileId.startsWith('https://')) {
            generatedImageUrl = fileId;
          }
        }
      } catch (dlErr: any) {
        console.error(`Error downloading image file ${fileId} from ${targetOrigin}:`, dlErr);
      }
    }

    if (!generatedImageUrl) {
      generatedImageUrl =
        upstreamData?.image_url ||
        upstreamData?.data?.image_url ||
        upstreamData?.data?.url ||
        (Array.isArray(upstreamData?.data?.images) ? upstreamData.data.images[0] : null) ||
        (Array.isArray(upstreamData?.data?.output) ? upstreamData.data.output[0] : null);
    }

    if (!generatedImageUrl && (bodyFields.simulate === 'true' || bodyFields.simulate === true)) {
      generatedImageUrl = `https://picsum.photos/seed/${Date.now()}/1024/1024`;
    }

    if (!generatedImageUrl) {
      const errorMsg = formatErrorString(
        upstreamData?.message ||
          upstreamData?.error ||
          upstreamData?.data?.error ||
          (upstreamData?.data?.outputs && upstreamData.data.outputs.image === null
            ? 'Workflow completed but output image is null'
            : 'Image generation failed: No image output returned')
      );

      return NextResponse.json({
        status: 'error',
        message: errorMsg,
        endpoint: targetEndpoint,
        file_id: fileId,
        image_url: null,
        requestPayload: payloadDebug,
        statusCode: upstreamRes.status,
        data: upstreamData,
      });
    }

    return NextResponse.json({
      status: 'success',
      endpoint: targetEndpoint,
      file_id: fileId,
      image_url: generatedImageUrl,
      requestPayload: payloadDebug,
      statusCode: upstreamRes.status,
      data: upstreamData,
    });
  } catch (err: any) {
    console.error('Error in /api/generate:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: formatErrorString(err) || 'Failed to communicate with Image Processing API',
      },
      { status: 500 }
    );
  }
}
