import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { X, Check, ZoomIn } from 'lucide-react';
import { getUserFacingError } from '../lib/userFacingError';

type AvatarCropModalProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
  shape?: 'circle' | 'square';
  title?: string;
  outputFileName?: string;
};

const FRAME_SIZE = 280; // on-screen crop frame, in CSS px
const OUTPUT_SIZE = 512; // exported image resolution
const MAX_ZOOM = 3;

export default function AvatarCropModal({
  file,
  onCancel,
  onConfirm,
  shape = 'circle',
  title = 'Adjust your photo',
  outputFileName = 'avatar.jpg',
}: AvatarCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const scale = Math.max(FRAME_SIZE / width, FRAME_SIZE / height);
      loadedImageRef.current = img;
      setNaturalSize({ width, height });
      setBaseScale(scale);
      setZoom(1);
      setOffset({
        x: (FRAME_SIZE - width * scale) / 2,
        y: (FRAME_SIZE - height * scale) / 2,
      });
    };
    img.src = url;
    return () => {
      loadedImageRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const clampOffset = (nextOffset: { x: number; y: number }, currentZoom: number) => {
    if (!naturalSize) return nextOffset;
    const scale = baseScale * currentZoom;
    const displayWidth = naturalSize.width * scale;
    const displayHeight = naturalSize.height * scale;
    const minX = FRAME_SIZE - displayWidth;
    const minY = FRAME_SIZE - displayHeight;
    return {
      x: Math.min(0, Math.max(minX, nextOffset.x)),
      y: Math.min(0, Math.max(minY, nextOffset.y)),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setOffset(
      clampOffset(
        { x: dragState.current.originX + dx, y: dragState.current.originY + dy },
        zoom
      )
    );
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev, nextZoom));
  };

  const [exportError, setExportError] = useState('');

  const handleConfirm = async () => {
    const img = loadedImageRef.current;
    if (!img || !naturalSize) return;
    setExporting(true);
    setExportError('');
    try {
      const scale = baseScale * zoom;
      const sourceX = -offset.x / scale;
      const sourceY = -offset.y / scale;
      const sourceSize = FRAME_SIZE / scale;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process that image.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Could not process that image.');

      const croppedFile = new File([blob], outputFileName, { type: 'image/jpeg' });
      onConfirm(croppedFile);
    } catch (error) {
      setExportError(getUserFacingError(error, 'We couldn’t process that image. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-panel bg-white p-6 shadow-card-hover">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onCancel} className="rounded-full p-1.5 text-muted hover:bg-[#F1EFE8] hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div
          className={`relative mx-auto touch-none overflow-hidden border border-line bg-[#F1EFE8] ${
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
          }`}
          style={{ width: FRAME_SIZE, height: FRAME_SIZE, cursor: dragState.current ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {imageUrl && naturalSize && (
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{
                left: offset.x,
                top: offset.y,
                width: naturalSize.width * baseScale * zoom,
                height: naturalSize.height * baseScale * zoom,
                maxWidth: 'none',
              }}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-muted" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <p className="mt-2 text-center text-xs text-muted">Drag to reposition, use the slider to zoom</p>
        {exportError && <p className="mt-2 text-center text-xs text-[#B3261E]">{exportError}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={exporting || !naturalSize}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check size={14} />
            {exporting ? 'Saving...' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}