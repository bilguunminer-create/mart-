/**
 * Utility to process and compress images to a reasonable size (max 800x800, JPEG 85%)
 * so they fit comfortably in client storage without exhausting browser quota.
 */
export async function processImageFile(file: File, maxWidth = 800, maxHeight = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Зураг уншихад алдаа гарлаа. Өөр зураг сонгоно уу.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Файл уншихад алдаа гарлаа.'));
    reader.readAsDataURL(file);
  });
}
