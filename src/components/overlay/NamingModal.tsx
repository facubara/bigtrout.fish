'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTroutStore } from '@/lib/store';

const NAME_REGEX = /^[a-zA-Z0-9_\-.]+$/;
const NAME_MAX_LENGTH = 20;
const NAME_MIN_LENGTH = 1;

export default function NamingModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const jwtToken = useTroutStore((s) => s.jwtToken);
  const walletAddress = useTroutStore((s) => s.walletAddress);
  const isVerified = useTroutStore((s) => s.isVerified);
  const troutMap = useTroutStore((s) => s.troutMap);

  // Listen for open event from WalletConnect
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setName('');
      setError(null);
      setSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    window.addEventListener('bigtrout:open-naming', handleOpen);
    return () => window.removeEventListener('bigtrout:open-naming', handleOpen);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  const validateClient = useCallback((value: string): string | null => {
    if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
      return `Name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters`;
    }
    if (!NAME_REGEX.test(value)) {
      return 'Only letters, numbers, underscores, hyphens, and dots allowed';
    }
    return null;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = name.trim();
      const clientError = validateClient(trimmed);
      if (clientError) {
        setError(clientError);
        return;
      }

      // Require JWT
      const token = jwtToken ?? localStorage.getItem('bigtrout:jwt');
      if (!token) {
        setError('Please verify your wallet first');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ displayName: trimmed }),
        });

        if (!res.ok) {
          const body = await res.json();
          setError(body.error ?? 'Failed to set name');
          return;
        }

        const data = await res.json();

        // Update the local store with the new display name
        if (walletAddress) {
          const existing = troutMap.get(walletAddress);
          if (existing) {
            useTroutStore.getState().addTrouts([
              { ...existing, displayName: data.displayName },
            ]);
          }
        }

        setSuccess(true);
        setTimeout(() => setOpen(false), 1500);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [name, jwtToken, walletAddress, troutMap, validateClient]
  );

  if (!open || !isVerified) return null;

  // Get current display name
  const currentName = walletAddress
    ? troutMap.get(walletAddress)?.displayName
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-[#1a1a2e] border border-white/10 rounded-lg w-full max-w-sm p-5 font-mono pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-sm">Name Your Trout</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white text-lg leading-none"
              aria-label="Close"
            >
              x
            </button>
          </div>

          {currentName && (
            <p className="text-white/40 text-xs mb-3">
              Current name: <span className="text-white/70">{currentName}</span>
            </p>
          )}

          {success ? (
            <div className="text-emerald-400 text-sm text-center py-4">
              Name updated successfully!
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter a name..."
                maxLength={NAME_MAX_LENGTH}
                className="w-full bg-black/40 text-white text-sm px-3 py-2 rounded border border-white/10 placeholder:text-white/30 outline-none focus:border-emerald-500/50 transition mb-1"
              />

              <div className="flex items-center justify-between mb-3">
                <span className="text-white/30 text-[10px]">
                  {name.length}/{NAME_MAX_LENGTH}
                </span>
                <span className="text-white/30 text-[10px]">
                  a-z, 0-9, _ - .
                </span>
              </div>

              {error && (
                <p className="text-red-400 text-xs mb-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || name.trim().length === 0}
                className="w-full bg-emerald-600 text-white text-sm py-2 rounded font-bold hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Set Name'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
