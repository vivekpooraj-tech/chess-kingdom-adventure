"use client";

import { useState } from "react";
import { TEXT } from "@/lib/designSystem";
import type { PinActionResult } from "./ChessTimeProvider";
import { useChessTimeOptional } from "./ChessTimeProvider";

export function ParentPinEntry({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: (pin: string) => Promise<PinActionResult>;
  onCancel?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(pin);
      if (!result.ok) {
        setError(result.error ?? "Incorrect PIN.");
        setPin("");
        return;
      }
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-4 rounded-premiumCard border border-premium-gold/20 bg-premium-navy p-6 shadow-premiumCard">
      <div>
        <h2 className={`${TEXT.heading} text-premium-ivory`}>{title}</h2>
        {subtitle && <p className={`${TEXT.body} mt-2`}>{subtitle}</p>}
      </div>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && pin.length >= 4 && !busy) void handleSubmit();
        }}
        aria-label="Parent PIN"
        disabled={busy}
        className="w-full text-center rounded-premiumBtn px-4 py-3 border border-premium-ivory/15 bg-premium-midnightDeep/50 font-classic-body text-xl tracking-[0.3em] text-premium-ivory focus:outline-none focus:border-premium-gold/60 disabled:opacity-60"
      />
      {error && <p className="font-classic-body text-sm text-semantic-retry">{error}</p>}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-[44px] rounded-full border border-white/15 font-classic-body text-sm text-premium-ivory/80"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={pin.length < 4 || busy}
          className="flex-1 min-h-[44px] rounded-full bg-premium-gold font-classic-body text-sm font-semibold text-premium-midnight disabled:opacity-40"
        >
          {busy ? "Checking…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function ParentPinSetup({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const chessTime = useChessTimeOptional();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!chessTime) return null;

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await chessTime!.setupParentPin(pin, confirm);
      if (!result.ok) {
        setError(result.error ?? "Could not save PIN.");
        return;
      }
      setPin("");
      setConfirm("");
      onComplete?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 rounded-premiumCard border border-premium-gold/20 bg-premium-navy p-6 shadow-premiumCard">
      <div>
        <h2 className={`${TEXT.heading} text-premium-ivory`}>Create Parent PIN</h2>
        <p className={`${TEXT.body} mt-2`}>
          A 4–6 digit PIN lets you start and exit Chess Time. It stays on this device only.
        </p>
      </div>
      <label className="flex flex-col gap-1">
        <span className={TEXT.caption}>New PIN</span>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          disabled={busy}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="rounded-premiumBtn px-4 py-3 border border-premium-ivory/15 bg-premium-midnightDeep/50 text-center tracking-[0.3em] text-premium-ivory"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={TEXT.caption}>Confirm PIN</span>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirm}
          disabled={busy}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          className="rounded-premiumBtn px-4 py-3 border border-premium-ivory/15 bg-premium-midnightDeep/50 text-center tracking-[0.3em] text-premium-ivory"
        />
      </label>
      {error && <p className="font-classic-body text-sm text-semantic-retry">{error}</p>}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={pin.length < 4 || confirm.length < 4 || busy}
        className="min-h-[44px] rounded-full bg-premium-gold font-classic-body text-sm font-semibold text-premium-midnight disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save Parent PIN"}
      </button>
    </div>
  );
}
