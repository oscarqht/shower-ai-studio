import JSZip from 'jszip';

export interface ZipExportAssets {
  markdownPrompt: string;
  characterImageBlob?: Blob | null;
  styleImageBlob?: Blob | null;
  attachmentImageBlob?: Blob | null;
}

export function generateTimestampFilename(prefix = 'prompt-bundle', ext = 'zip'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${prefix}-${yyyy}${MM}${dd}-${hh}${mm}${ss}.${ext}`;
}

export async function createPromptZip(assets: ZipExportAssets): Promise<Blob> {
  const zip = new JSZip();

  // 1. Markdown prompt file
  zip.file('prompt.md', assets.markdownPrompt || '');

  // 2. Images if present
  if (assets.characterImageBlob) {
    zip.file('character-references.png', assets.characterImageBlob);
  }
  if (assets.styleImageBlob) {
    zip.file('style-references.png', assets.styleImageBlob);
  }
  if (assets.attachmentImageBlob) {
    zip.file('attachments.png', assets.attachmentImageBlob);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
