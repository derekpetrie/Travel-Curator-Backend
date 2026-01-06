export async function generateThumbnailFromUrl(imageUrl: string, maxSize: number = 200): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image from URL: ${response.status}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const sharp = await import('sharp');
    
    const thumbnailBuffer = await sharp.default(buffer)
      .resize(maxSize, maxSize, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 60 })
      .toBuffer();
    
    const thumbnailBase64 = thumbnailBuffer.toString('base64');
    return `data:image/jpeg;base64,${thumbnailBase64}`;
  } catch (err) {
    console.error("Error generating thumbnail from URL:", err);
    return null;
  }
}

export async function generateThumbnailFromBase64(base64Image: string, maxSize: number = 200): Promise<string | null> {
  if (!base64Image || !base64Image.startsWith('data:image')) {
    return null;
  }

  try {
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
  } catch (err) {
    console.error("Error generating thumbnail from base64:", err);
    return null;
  }
}

export async function generateThumbnailCanvas(imageSource: string, maxSize: number = 200): Promise<string | null> {
  if (!imageSource) {
    return null;
  }
  
  if (imageSource.startsWith('data:image')) {
    return generateThumbnailFromBase64(imageSource, maxSize);
  } else if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return generateThumbnailFromUrl(imageSource, maxSize);
  }
  
  return null;
}
