'use client';

import { useState, useCallback } from 'react';

export default function ScreenshotButton() {
  const [showMenu, setShowMenu] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const captureCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    // Find the PixiJS canvas element
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;

    // Create a copy with watermark
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    // Draw the scene
    ctx.drawImage(canvas, 0, 0);

    // Draw watermark
    const fontSize = Math.max(14, Math.floor(canvas.width / 60));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('bigtrout.fish', canvas.width - 16, canvas.height - 12);

    return out;
  }, []);

  const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  const handleDownload = useCallback(async () => {
    setCapturing(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;

      const blob = await toBlob(canvas);
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bigtrout-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCapturing(false);
      setShowMenu(false);
    }
  }, [captureCanvas]);

  const handleCopy = useCallback(async () => {
    setCapturing(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;

      const blob = await toBlob(canvas);
      if (!blob) return;

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } finally {
      setCapturing(false);
      setShowMenu(false);
    }
  }, [captureCanvas]);

  const handleShareTwitter = useCallback(async () => {
    const text = encodeURIComponent(
      'Check out my trout on bigtrout.fish! #BigTroutFish #Solana'
    );
    const url = encodeURIComponent('https://bigtrout.fish');
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer'
    );
    setShowMenu(false);
  }, []);

  return (
    <div className="relative pointer-events-auto">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={capturing}
        className="bg-black/40 backdrop-blur-sm text-white/70 w-8 h-8 rounded-md font-mono text-sm hover:bg-black/60 hover:text-white transition flex items-center justify-center disabled:opacity-50"
        title="Screenshot"
        aria-label="Screenshot"
      >
        {capturing ? '...' : 'SS'}
      </button>

      {showMenu && (
        <div className="absolute bottom-full mb-1 right-0 bg-black/80 backdrop-blur-md rounded-md border border-white/10 overflow-hidden min-w-36 z-50">
          <button
            onClick={handleDownload}
            className="w-full text-left px-3 py-2 text-sm font-mono text-white/80 hover:bg-white/10 transition"
          >
            Download PNG
          </button>
          <button
            onClick={handleCopy}
            className="w-full text-left px-3 py-2 text-sm font-mono text-white/80 hover:bg-white/10 transition"
          >
            Copy to clipboard
          </button>
          <button
            onClick={handleShareTwitter}
            className="w-full text-left px-3 py-2 text-sm font-mono text-white/80 hover:bg-white/10 transition"
          >
            Share to X
          </button>
        </div>
      )}
    </div>
  );
}
