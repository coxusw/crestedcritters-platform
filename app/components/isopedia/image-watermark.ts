"use client";

const WATERMARK_TEXT = "Isopedia";
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

function safeExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (extension === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(extension)) return extension;
  return "jpg";
}

function outputTypeForExtension(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image for watermarking."));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare watermarked image."));
      },
      type,
      quality
    );
  });
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number) {
  const fontSize = Math.max(24, Math.min(54, Math.round(width * 0.06)));
  const padding = Math.max(12, Math.round(width * 0.022));

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.46)";
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.055));
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.16));
  ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.05));
  ctx.strokeText(WATERMARK_TEXT, width - padding, padding);
  ctx.fillText(WATERMARK_TEXT, width - padding, padding);
  ctx.restore();
}

export async function watermarkImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Uploaded file must be an image.");
  }

  const sourceImage = await loadImageFromFile(file);
  const maxDimension = 1800;
  const longestSide = Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const extension = safeExtension(file);
  const outputType = outputTypeForExtension(extension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image watermark.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(sourceImage, 0, 0, width, height);
  drawWatermark(ctx, width);

  let quality = 0.88;
  let blob = await canvasToBlob(canvas, outputType, quality);

  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.62 && outputType !== "image/png") {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, outputType, quality);
  }

  if (blob.size > MAX_OUTPUT_BYTES && file.size <= MAX_OUTPUT_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.78);
  }

  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error("Image is still too large after watermarking. Please crop it or choose a smaller image.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "isopedia-image";
  const outputExtension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";

  return new File([blob], `${baseName}.${outputExtension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}
