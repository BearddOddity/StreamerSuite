// Downscales and re-encodes an uploaded image as JPEG before it's stored as
// a data: URI in the shared settings blob (localStorage). Wallpapers don't
// need source resolution or lossless quality — 1920px/85% keeps typical
// photos well under a few hundred KB, versus multi-MB originals that would
// otherwise risk blowing the localStorage quota and silently killing every
// future settings write (see SharedSettingsContext's persist effect).
export function compressImage(file: File, maxSize = 1920, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error("Image too large. Max 25 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
