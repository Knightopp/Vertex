import sharp from 'sharp';

async function resizeIcon() {
  const input = 'public/images/vertex_v_logo.png';
  const output = 'public/images/vertex_app_icon.png';

  try {
    // Get original metadata
    const metadata = await sharp(input).metadata();
    
    // We want to add 30% padding. So the new width is originalWidth / 0.7.
    // However, Tauri expects a square icon for best results.
    const maxDim = Math.max(metadata.width, metadata.height);
    
    // Let's create a square canvas that is 1.4x the maximum dimension
    const canvasSize = Math.round(maxDim * 1.4);

    await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent
      }
    })
    .composite([
      {
        input: input,
        gravity: 'center'
      }
    ])
    .toFile(output);

    console.log(`Successfully created padded icon at ${output}`);
  } catch (error) {
    console.error('Error resizing icon:', error);
  }
}

resizeIcon();
