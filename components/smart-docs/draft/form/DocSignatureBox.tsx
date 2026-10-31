'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface DocSignatureBoxProps {
  partyType: 'importer' | 'exporter' | string;
  title: string;
  onTitleChange: (val: string) => void;
  signatureUrl: string;
  onSignatureChange: (url: string) => void;
  authorityTitle: string;
  onAuthorityTitleChange: (val: string) => void;
  titlePlaceholder?: string;
  authorityPlaceholder?: string;
  readOnly?: boolean;
  className?: string;
  uploadButtonLabel?: string;
  clearButtonLabel?: string;
}

// Fixed standard professional blue ink color for trade contracts
const STANDARD_PEN_COLOR = '#0284c7';

interface Point {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
}

export function DocSignatureBox({
  partyType,
  title,
  onTitleChange,
  signatureUrl,
  onSignatureChange,
  authorityTitle,
  onAuthorityTitleChange,
  titlePlaceholder,
  authorityPlaceholder,
  readOnly = false,
  className = '',
}: DocSignatureBoxProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const authTitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Layer 1: Stamp Image
  const stampImgRef = useRef<HTMLImageElement | null>(null);
  const [hasStamp, setHasStamp] = useState<boolean>(false);

  // Layer 2: Signature Strokes (Array of stroke paths, normalized 0..1 coordinates)
  const strokesRef = useRef<Point[][]>([]);
  const [hasDrawnSignature, setHasDrawnSignature] = useState<boolean>(false);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);

  // Base image if loaded from initial signatureUrl (before any edit)
  const initialImgRef = useRef<HTMLImageElement | null>(null);

  // Internal export tracking to prevent echo loops
  const lastExportUrlRef = useRef<string>(signatureUrl || '');

  // Active stroke drawing refs (does not trigger re-render on pointer moves)
  const isPointerDownRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<Point[]>([]);

  // Redraw all layers:
  // Layer 1 (Bottom): Stamp Image / Loaded Image
  // Layer 2 (Top): Drawn Signature Strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    // Ensure internal buffer matches displayed size at current DPI
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Reset transform & clear backing buffer
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // LAYER 1: Stamp Image or Initial Saved Image (BOTTOM LAYER)
    const baseImg = stampImgRef.current || initialImgRef.current;
    if (baseImg && baseImg.width > 0 && baseImg.height > 0) {
      const pad = 12;
      const availW = Math.max(10, w - pad * 2);
      const availH = Math.max(10, h - pad * 2);
      const ratio = Math.min(availW / baseImg.width, availH / baseImg.height, 1);
      const drawW = baseImg.width * ratio;
      const drawH = baseImg.height * ratio;
      const offsetX = pad + (availW - drawW) / 2;
      const offsetY = pad + (availH - drawH) / 2;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(baseImg, offsetX, offsetY, drawW, drawH);
      ctx.restore();
    }

    // LAYER 2: User's Drawn Signature Strokes (TOP LAYER)
    // Always drawn OVER the stamp so the signature is never hidden by the stamp!
    if (strokesRef.current.length > 0) {
      ctx.save();
      ctx.strokeStyle = STANDARD_PEN_COLOR;
      ctx.fillStyle = STANDARD_PEN_COLOR;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const stroke of strokesRef.current) {
        if (!stroke || stroke.length === 0) continue;

        if (stroke.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke[0].x * w, stroke[0].y * h, 1.25, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(stroke[0].x * w, stroke[0].y * h);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x * w, stroke[i].y * h);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Export merged composite PNG to parent
    const hasAnyContent = Boolean(
      stampImgRef.current ||
        strokesRef.current.length > 0 ||
        (initialImgRef.current && strokesRef.current.length === 0)
    );

    if (hasAnyContent) {
      const dataUrl = canvas.toDataURL('image/png');
      lastExportUrlRef.current = dataUrl;
      onSignatureChange(dataUrl);
    } else {
      lastExportUrlRef.current = '';
      onSignatureChange('');
    }
  }, [onSignatureChange]);

  // Sync canvas width/height with display resolution (Retina/DPI safe)
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    redrawCanvas();
  }, [redrawCanvas]);

  // Observe container size dynamically (fires on mount, tab change, accordion expand, resize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncCanvasSize();
      });
      resizeObserver.observe(container);
    }

    syncCanvasSize();
    const handleResize = () => syncCanvasSize();
    window.addEventListener('resize', handleResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [syncCanvasSize]);

  // Initial load from props if signatureUrl was provided by server/draft
  useEffect(() => {
    if (
      signatureUrl &&
      signatureUrl !== lastExportUrlRef.current &&
      !stampImgRef.current &&
      strokesRef.current.length === 0
    ) {
      const img = new Image();
      img.onload = () => {
        initialImgRef.current = img;
        redrawCanvas();
      };
      img.src = signatureUrl;
    } else if (!signatureUrl && (hasStamp || hasDrawnSignature)) {
      // Cleared externally
      stampImgRef.current = null;
      strokesRef.current = [];
      initialImgRef.current = null;
      setHasStamp(false);
      setHasDrawnSignature(false);
      redrawCanvas();
    }
  }, [signatureUrl, hasStamp, hasDrawnSignature, redrawCanvas]);

  // Coordinates helper (normalizes to 0..1 range)
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    return { x, y };
  };

  // Start Drawing Stroke (Universal Pointer Event: Mouse, Touch, Stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const pt = getNormalizedPoint(e);
    if (!pt) return;

    isPointerDownRef.current = true;
    setIsDrawingMode(true);
    currentStrokeRef.current = [pt];

    // Live canvas dot drawing for immediate zero-latency visual feedback
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = STANDARD_PEN_COLOR;
      ctx.fillStyle = STANDARD_PEN_COLOR;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.arc(pt.x * rect.width, pt.y * rect.height, 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pt.x * rect.width, pt.y * rect.height);
    }
  };

  // Continue Drawing Stroke
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || readOnly) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    currentStrokeRef.current.push(pt);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = STANDARD_PEN_COLOR;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
      ctx.stroke();
    }
  };

  // End Drawing Stroke
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
      setHasDrawnSignature(true);
      redrawCanvas();
    }
  };

  // Upload Stamp / Signature Image
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      const res = uploadEvt.target?.result;
      if (typeof res !== 'string') return;

      const img = new Image();
      img.onload = () => {
        stampImgRef.current = img;
        initialImgRef.current = null; // Replaced by user's uploaded stamp
        setHasStamp(true);
        syncCanvasSize();
        redrawCanvas();
      };
      img.src = res;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Undo last drawn stroke
  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    if (strokesRef.current.length === 0) {
      setHasDrawnSignature(false);
    }
    redrawCanvas();
  };

  // Clear drawn signature strokes only (Stamp image is NEVER deleted)
  const handleClearSignature = () => {
    strokesRef.current = [];
    setHasDrawnSignature(false);
    redrawCanvas();
  };

  // Clear everything (both stamp and drawn strokes)
  const handleClearAll = () => {
    stampImgRef.current = null;
    initialImgRef.current = null;
    strokesRef.current = [];
    setHasStamp(false);
    setHasDrawnSignature(false);
    redrawCanvas();
  };

  // Activate / Focus drawing mode
  const handleActivateDrawing = () => {
    if (readOnly) return;
    setIsDrawingMode(true);
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const hasAnyContent = hasStamp || hasDrawnSignature || Boolean(signatureUrl);

  return (
    <div className={`p-3 sm:p-4 flex flex-col items-center w-full ${className}`}>
      {/* Top Header: Title with dotted underline & edit pencil */}
      <div className="flex items-center justify-center gap-1.5 w-full">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value.toUpperCase())}
          disabled={readOnly}
          aria-label={`${partyType} title`}
          placeholder={
            titlePlaceholder ||
            (partyType === 'exporter'
              ? 'SELLER / EXPORTER'
              : partyType === 'broker'
              ? 'BROKER'
              : 'BUYER / IMPORTER')
          }
          className="font-bold text-center tracking-wider text-[14px] uppercase bg-transparent border-b-2 border-dotted border-primary/60 hover:border-primary focus:border-solid focus:border-primary focus:outline-none text-foreground py-0.5 px-2 w-full max-w-[280px] sm:max-w-[340px] transition-colors placeholder:text-[14px] placeholder:font-normal placeholder:uppercase placeholder:text-muted-foreground/50"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => titleInputRef.current?.focus()}
            title="Edit title"
            className="text-primary hover:text-primary-hover transition-colors p-0.5 cursor-pointer disabled:opacity-40"
          >
            <i className="fa-solid fa-pen text-xs" />
          </button>
        )}
      </div>

      {/* Signature & Stamp Multi-Layer Interactive Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-40 sm:h-48 my-2 rounded-lg bg-background dark:bg-card border-2 border-dashed transition-all flex items-center justify-center relative overflow-hidden shadow-2xs group select-none ${
          isDrawingMode
            ? 'border-primary ring-2 ring-primary/25'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <canvas
          ref={canvasRef}
          style={{ touchAction: 'none' }}
          className={`w-full h-full touch-none select-none ${
            readOnly ? 'cursor-default' : 'cursor-crosshair'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Empty Canvas Prompt / Instructions */}
        {!hasAnyContent && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/75 select-none p-3 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1.5 shadow-2xs">
              <i className="fa-solid fa-pen-nib text-base" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-foreground/90">
              Draw Signature Directly Here
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              Sign with mouse, trackpad, or finger &bull; Or upload stamp below
            </span>
          </div>
        )}

        {/* Canvas Quick Tools: Undo / Clear for hand-drawn signature */}
        {hasDrawnSignature && !readOnly && (
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10 bg-background/90 dark:bg-card/90 backdrop-blur-xs p-1 rounded-md border border-border/80 shadow-xs">
            <button
              type="button"
              onClick={handleUndo}
              title="Undo last stroke"
              aria-label="Undo last stroke"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted text-xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-rotate-left text-[11px]" />
            </button>
            <button
              type="button"
              onClick={handleClearSignature}
              title="Clear signature strokes"
              aria-label="Clear signature strokes"
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-eraser text-[11px]" />
            </button>
          </div>
        )}
      </div>

      {/* Action Controls Toolbar: Clean buttons with contextual Clear Signature */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 w-full px-0.5 my-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleStampUpload}
        />
        <button
          type="button"
          disabled={readOnly}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-md border border-border/80 bg-card hover:bg-muted text-foreground text-xs font-medium shadow-2xs hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-stamp text-[11px] text-muted-foreground" />
          <span>Upload Stamp / Signature</span>
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={handleActivateDrawing}
          className={`px-3 py-1.5 rounded-md border text-xs font-medium shadow-2xs hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
            isDrawingMode
              ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
              : 'border-border/80 bg-card hover:bg-muted text-foreground'
          }`}
        >
          <i className="fa-solid fa-pen-nib text-[11px]" />
          <span>Draw Signature</span>
        </button>

        {/* Clear Signature strokes button: appears when user has drawn strokes */}
        {hasDrawnSignature && !readOnly && (
          <button
            type="button"
            onClick={handleClearSignature}
            title="Clear signature strokes (keeps stamp)"
            className="px-3 py-1.5 rounded-md border border-border/80 bg-card hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive text-muted-foreground text-xs font-medium shadow-2xs hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-eraser text-[11px]" />
            <span>Clear Signature</span>
          </button>
        )}

        {/* Clear All button: appears when stamp is present */}
        {hasStamp && !readOnly && (
          <button
            type="button"
            onClick={handleClearAll}
            title="Clear stamp and signature"
            className="px-3 py-1.5 rounded-md border border-border/80 bg-card hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive text-muted-foreground text-xs font-medium shadow-2xs hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-trash-can text-[11px]" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Bottom Label: Authority Signature title with expanded width & edit pencil */}
      <div className="flex items-center justify-center gap-1.5 w-full mt-3">
        <input
          ref={authTitleInputRef}
          type="text"
          value={authorityTitle}
          onChange={(e) => onAuthorityTitleChange(e.target.value.toUpperCase())}
          disabled={readOnly}
          aria-label={`${partyType} authority title`}
          placeholder={authorityPlaceholder || 'AUTHORISED SIGNATURE'}
          className="font-bold text-center tracking-wider text-[14px] uppercase bg-transparent border-b-2 border-dotted border-primary/60 hover:border-primary focus:border-solid focus:border-primary focus:outline-none text-foreground py-0.5 px-2 w-full max-w-[280px] sm:max-w-[340px] transition-colors placeholder:text-[14px] placeholder:font-normal placeholder:uppercase placeholder:text-muted-foreground/50"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => authTitleInputRef.current?.focus()}
            title="Edit label"
            className="text-primary hover:text-primary-hover transition-colors p-0.5 cursor-pointer disabled:opacity-40"
          >
            <i className="fa-solid fa-pen text-xs" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DocSignatureBox;
