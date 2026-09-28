// Normalizes an uploaded image to the orientation the user sees.
// Phone photos store sideways pixels plus an EXIF Orientation tag: browsers apply the
// tag on screen, but jsPDF embeds the raw pixels, so the PDF showed the image rotated
// and squeezed into the on-screen width/height. createImageBitmap with
// imageOrientation 'from-image' applies the tag (MDN), and the pixels are re-encoded
// upright — JPEG stays JPEG (quality 0.92), anything else becomes PNG (keeps alpha).
// Returns { dataUrl, w, h } where w/h are the real pixel size of dataUrl.
export async function normalizeImageFile(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    const jpeg = file.type === 'image/jpeg'
    return {
      dataUrl: canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92),
      w: canvas.width,
      h: canvas.height,
    }
  } finally {
    bitmap.close?.()
  }
}
