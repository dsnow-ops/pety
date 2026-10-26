// These are upload copies of user references, never generated 2K master assets.
// Stay within both the header limit and jpeg-js's 128 MB decode budget,
// including the 4:4:4 JPEGs emitted by browser canvas encoders.
const RESIZED_SOURCE_EDGE = 2048;

export async function prepareAvatarSourceImage(filePath) {
  // Native pickers retain their existing saveFile/permission behavior.
  // #ifdef H5
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    const failure = () => Object.assign(new Error('AVATAR_SOURCE_IMAGE_UNREADABLE'), {
      code: 'AVATAR_SOURCE_IMAGE_UNREADABLE', stage: 'SOURCE_PREPARATION'
    });
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(failure());
        image.src = filePath;
      });
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height) throw failure();
      if (width <= RESIZED_SOURCE_EDGE && height <= RESIZED_SOURCE_EDGE) return filePath;
      const scale = Math.min(1, RESIZED_SOURCE_EDGE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      try {
        const context = canvas.getContext('2d');
        if (!context) throw failure();
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob?.size || blob.type !== 'image/jpeg') throw failure();
        return URL.createObjectURL(blob);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (_) {
      throw failure();
    } finally {
      image.onload = null;
      image.onerror = null;
    }
  }
  // #endif
  return filePath;
}
