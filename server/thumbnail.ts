export function generateThumbnail(base64Image: string, maxSize: number = 200): string {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return base64Image;
  }

  return base64Image;
}

export async function generateThumbnailCanvas(base64Image: string, maxSize: number = 200): Promise<string> {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return base64Image;
  }

  const sharp = await import('sharp');
  
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  const thumbnailBuffer = await sharp.default(buffer)
    .resize(maxSize, maxSize, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 60 })
    .toBuffer();
  
  const thumbnailBase64 = thumbnailBuffer.toString('base64');
  return `data:image/jpeg;base64,${thumbnailBase64}`;
}
