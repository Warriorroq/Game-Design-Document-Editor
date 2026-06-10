const MAX_DIMENSION = 720;
const JPEG_QUALITY = 0.82;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

function imageHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function mimeSupportsAlpha(mime: string): boolean {
  return mime === "image/png" || mime === "image/webp" || mime === "image/gif";
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  if (scale === 1 && mimeSupportsAlpha(blob.type)) {
    bitmap.close();
    return readBlobAsDataUrl(blob);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const usePng =
    mimeSupportsAlpha(blob.type) || imageHasAlpha(ctx, width, height);
  return usePng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function getImageFromClipboard(clipboard: DataTransfer): Blob | null {
  for (const item of Array.from(clipboard.items)) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

function dataUrlToBlob(src: string): Blob {
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?(;base64)?,(.*)$/s.exec(src);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const data = match[3];
  if (match[2]) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

async function blobToPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas unavailable");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((encoded) => {
      if (encoded) resolve(encoded);
      else reject(new Error("Failed to encode image"));
    }, "image/png");
  });
}

function imageElementToPngBlob(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas unavailable"));
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((encoded) => {
      if (encoded) resolve(encoded);
      else reject(new Error("Failed to encode image"));
    }, "image/png");
  });
}

export async function imageSrcToBlob(src: string): Promise<Blob> {
  if (src.startsWith("data:")) {
    return dataUrlToBlob(src);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      void imageElementToPngBlob(img).then(resolve).catch(reject);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Clipboard write must start in the same user gesture — pass a Promise, do not await the blob first. */
export function copyImageSrcToClipboard(src: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("Clipboard unavailable"));
  }

  const pngPromise = (async () => {
    const blob = await imageSrcToBlob(src);
    return blobToPng(blob);
  })();

  return navigator.clipboard.write([
    new ClipboardItem({
      "image/png": pngPromise,
    }),
  ]);
}

export function loadImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
