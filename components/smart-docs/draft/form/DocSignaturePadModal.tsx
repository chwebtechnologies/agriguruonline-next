'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface DocSignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  title?: string;
  dict?: any;
}

export function DocSignaturePadModal({
  isOpen,
  onClose,
  onSave,
  title = 'Draw Signature',
  dict,
}: DocSignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<string>('#0284c7'); // Default brand sky-600 / primary

  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = penColor;

    // Clear with transparent background
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  }, [penColor]);

  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow modal container to render dimensions
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initCanvas]);

  const getCanvasCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    setIsDrawing(true);
    lastPos.current = coords;
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (!coords || !lastPos.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = penColor;
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPos.current = coords;
    if (!hasDrawn) setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-signature text-primary text-sm" />
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body: Signature Canvas */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sign with mouse, trackpad, or finger</span>
            {/* Pen Color Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium mr-1 text-foreground">Ink:</span>
              <button
                type="button"
                onClick={() => setPenColor('#0284c7')}
                className={`w-5 h-5 rounded-full bg-sky-600 transition-all ${
                  penColor === '#0284c7' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                title="Blue ink"
              />
              <button
                type="button"
                onClick={() => setPenColor('#0f172a')}
                className={`w-5 h-5 rounded-full bg-slate-900 border border-slate-600 transition-all ${
                  penColor === '#0f172a' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                title="Black ink"
              />
              <button
                type="button"
                onClick={() => setPenColor('#1e3a8a')}
                className={`w-5 h-5 rounded-full bg-blue-900 border border-blue-600 transition-all ${
                  penColor === '#1e3a8a' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                title="Dark Navy ink"
              />
              <button
                type="button"
                onClick={() => setPenColor('#dc2626')}
                className={`w-5 h-5 rounded-full bg-red-600 transition-all ${
                  penColor === '#dc2626' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                title="Red ink"
              />
            </div>
          </div>

          <div className="relative border-2 border-dashed border-border rounded-lg bg-background h-52 sm:h-60 w-full overflow-hidden flex items-center justify-center touch-none select-none shadow-inner">
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute pointer-events-none text-muted-foreground/60 font-medium text-sm flex flex-col items-center gap-1.5 select-none">
                <i className="fa-solid fa-pen-nib text-base opacity-40 text-muted-foreground" />
                <span>Sign here</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasDrawn}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-rotate-left text-[11px]" />
            <span>Clear</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasDrawn}
              onClick={handleApply}
              className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-check text-xs" />
              <span>Apply Signature</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocSignaturePadModal;

