export interface ImageItem {
  url: string;
  label?: string;
}

export interface CombinedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

function getSafeImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image from: ${src}`));
    img.src = src;
  });
}

export async function combineImages(
  items: ImageItem[],
  options?: {
    maxCellSize?: number;
    gap?: number;
    padding?: number;
    backgroundColor?: string;
    showLabels?: boolean;
  }
): Promise<CombinedImageResult | null> {
  const validItems = items.filter((item) => item && item.url && item.url.trim());
  if (validItems.length === 0) return null;

  const count = validItems.length;
  let cols = 1;
  let rows = 1;

  if (count === 1) {
    cols = 1;
    rows = 1;
  } else if (count === 2) {
    cols = 2;
    rows = 1;
  } else if (count <= 4) {
    cols = 2;
    rows = Math.ceil(count / 2);
  } else if (count <= 6) {
    cols = 3;
    rows = 2;
  } else if (count <= 8) {
    cols = 4;
    rows = 2;
  } else if (count <= 9) {
    cols = 3;
    rows = 3;
  } else {
    cols = 4;
    rows = Math.ceil(count / 4);
  }

  const cellSize = options?.maxCellSize || 800;
  const gap = options?.gap ?? 24;
  const padding = options?.padding ?? 28;
  const bgColor = options?.backgroundColor || '#161412';
  const showLabels = options?.showLabels ?? true;

  const labelHeight = showLabels && validItems.some((i) => i.label) ? 68 : 0;
  const cellHeight = cellSize + labelHeight;

  const canvasWidth = cols * cellSize + (cols - 1) * gap + padding * 2;
  const canvasHeight = rows * cellHeight + (rows - 1) * gap + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Load images in parallel
  const loadedImages = await Promise.all(
    validItems.map(async (item) => {
      try {
        const safeSrc = getSafeImageUrl(item.url);
        const img = await loadImage(safeSrc);
        return { img, label: item.label };
      } catch (err) {
        console.warn('Could not load image for combining:', item.url, err);
        return null;
      }
    })
  );

  loadedImages.forEach((loaded, index) => {
    if (!loaded) return;
    const { img, label } = loaded;

    const col = index % cols;
    const row = Math.floor(index / cols);

    const cellX = padding + col * (cellSize + gap);
    const cellY = padding + row * (cellHeight + gap);

    // Draw card background for the slot
    ctx.save();
    ctx.fillStyle = '#221E1A';
    roundRect(ctx, cellX, cellY, cellSize, cellHeight, 16);
    ctx.fill();

    // Inner image bounding box
    const imgBoxX = cellX + 12;
    const imgBoxY = cellY + 12;
    const imgBoxW = cellSize - 24;
    const imgBoxH = cellSize - 24;

    // Clip image to rounded rectangle inside slot
    ctx.save();
    roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 12);
    ctx.clip();

    // Fit image keeping aspect ratio (contain)
    const scale = Math.min(imgBoxW / img.width, imgBoxH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = imgBoxX + (imgBoxW - drawW) / 2;
    const drawY = imgBoxY + (imgBoxH - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Draw label below image if available
    if (labelHeight > 0 && label) {
      const labelY = cellY + cellSize + 8;
      const labelW = cellSize - 24;
      const labelH = labelHeight - 16;
      const labelX = cellX + 12;

      ctx.fillStyle = '#2F2923';
      roundRect(ctx, labelX, labelY, labelW, labelH, 10);
      ctx.fill();

      ctx.fillStyle = '#F5EFEA';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX + labelW / 2, labelY + labelH / 2, labelW - 20);
    }

    ctx.restore();
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          dataUrl,
          blob,
          width: canvasWidth,
          height: canvasHeight,
        });
      },
      'image/png',
      0.95
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && (window as any).ClipboardItem) {
      const item = new (window as any).ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err);
  }
  return false;
}

export function downloadImage(blobOrUrl: Blob | string, filename: string) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
