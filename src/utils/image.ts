export async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize image canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load selected image'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

export function identifierToAuthEmail(identifier: string, coachingCode?: string): string {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }
  const digits = clean.replace(/\D/g, '').slice(-10);
  const codePart = (coachingCode || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (digits.length >= 6) {
    return codePart ? `st.${codePart}.${digits}@student.5tar.app` : `st.${digits}@student.5tar.app`;
  }
  const safeSlug = clean.replace(/[^a-z0-9]/g, '');
  return codePart ? `st.${codePart}.${safeSlug}@student.5tar.app` : `st.${safeSlug}@student.5tar.app`;
}
