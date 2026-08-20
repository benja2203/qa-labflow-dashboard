import React, { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

// Firma dibujada a mano (mouse/dedo) sobre un canvas, capturada como imagen
// PNG (data URL). No es una prueba criptográfica de identidad -- sigue
// guardándose en este mismo navegador -- pero exige que la persona que
// autoriza esté físicamente presente en el momento y dibuje algo que no se
// puede tipear, lo que es mucho más difícil de objetar que un nombre suelto.
export default function SignaturePad({ value, onChange, disabled }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(!value);

  const getContext = () => canvasRef.current?.getContext('2d');

  const resizeCanvasToContainer = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = getContext();
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.25;
    ctx.strokeStyle = '#1e293b';

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
  };

  useEffect(() => {
    resizeCanvasToContainer();
    window.addEventListener('resize', resizeCanvasToContainer);
    return () => window.removeEventListener('resize', resizeCanvasToContainer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRelativePoint = event => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = event => {
    if (disabled) return;
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getRelativePoint(event);
  };

  const handlePointerMove = event => {
    if (disabled || !isDrawingRef.current) return;
    event.preventDefault();

    const ctx = getContext();
    const point = getRelativePoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;

    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setIsEmpty(false);
    }
  };

  const handlePointerUp = () => {
    if (disabled || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (hasInkRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = getContext();
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    hasInkRef.current = false;
    setIsEmpty(true);
    onChange('');
  };

  return (
    <div>
      <div
        ref={containerRef}
        className={`relative h-32 w-full overflow-hidden rounded-lg border-2 border-dashed bg-white ${
          disabled ? 'border-slate-200 opacity-75' : 'border-slate-300'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={disabled ? 'cursor-not-allowed' : 'cursor-crosshair touch-none'}
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-8 border-b border-slate-200" />
        {isEmpty && !disabled && (
          <p className="pointer-events-none absolute bottom-2 left-3 text-xs italic text-slate-400">
            Firmá acá con el dedo o el mouse
          </p>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          Dibujado en el momento por la persona que autoriza — no se puede tipear.
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser className="h-3 w-3" />
            Borrar firma
          </button>
        )}
      </div>
    </div>
  );
}
