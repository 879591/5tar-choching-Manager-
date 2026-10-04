/**
 * Compresses and resizes a photo selected from the user's device gallery
 * into a clean Data URL (JPEG) under 150KB so it can be stored directly
 * in the student's profile and ID card.
 */
export function processGalleryPhotoFile(
  file: File,
  maxDimension = 320,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('कृपया केवल फोटो (Image) फ़ाइल चुनें।'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('फोटो पढ़ने में समस्या हुई।'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('अमान्य फोटो फ़ाइल।'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context उपलब्ध नहीं है।'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
