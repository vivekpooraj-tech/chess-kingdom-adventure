"use client";

import { useState } from "react";
import { TEXT } from "@/lib/designSystem";
import {
  CHESS_TIME_ACTIVITIES,
} from "@/lib/parentLock/activities";
import {
  CHESS_TIME_DURATION_PRESETS,
  DEFAULT_CHESS_TIME_ACTIVITIES,
  type ChessTimeActivityId,
} from "@/lib/parentLock/types";
import { ScreenPinningGuide } from "./ChessTimeBanner";
import { ChessTimeActivityLinks } from "./ChessTimeActivityLinks";
import { useChessTime } from "./ChessTimeProvider";
import { ParentPinEntry, ParentPinSetup } from "./ParentPinForms";

export function ParentLockSettings() {
  const {
    pinConfigured,
    session,
    expired,
    startChessTime,
    endChessTimeWithPin,
    changeParentPin,
    clearParentPinWithVerification,
  } = useChessTime();

  const [duration, setDuration] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState("30");
  const [selected, setSelected] = useState<ChessTimeActivityId[]>([
    ...DEFAULT_CHESS_TIME_ACTIVITIES,
  ]);
  const [showExitPin, setShowExitPin] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  function toggleActivity(id: ChessTimeActivityId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function resolvedDuration(): number {
    if (duration === -1) {
      const n = parseInt(customMinutes, 10);
      return Number.isFinite(n) ? n : 30;
    }
    return duration;
  }

  function handleStart() {
    if (selected.length === 0) return;
    startChessTime(resolvedDuration(), selected);
  }

  if (!pinConfigured) {
    return (
      <div className="w-full flex flex-col gap-6">
        <div>
          <p className={`${TEXT.meta} text-premium-gold`}>Parent Lock</p>
          <h2 className={`${TEXT.heading} mt-1`}>Help your child stay focused on chess</h2>
          <p className={`${TEXT.body} mt-2`}>
            Set a Parent PIN first, then start Chess Time when you hand over the device.
          </p>
        </div>
        <ParentPinSetup />
        <ScreenPinningGuide />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <p className={`${TEXT.meta} text-premium-gold`}>Parent Lock</p>
        <h2 className={`${TEXT.heading} mt-1`}>Chess Time</h2>
        <p className={`${TEXT.body} mt-2`}>
          Focus Mode keeps Chess Mind focused. It does not block YouTube or other apps unless you
          also enable Screen Pinning on your device (see below).
        </p>
      </div>

      {session?.active && !expired ? (
        <div className="rounded-premiumCard border border-premium-gold/30 bg-premium-gold/10 p-5 flex flex-col gap-3">
          <p className="font-classic-display text-lg text-premium-ivory">Chess Time is running</p>
          <p className={TEXT.body}>Your child sees the Chess Time home with a countdown.</p>
          {!showExitPin ? (
            <button
              type="button"
              onClick={() => setShowExitPin(true)}
              className="self-start min-h-[44px] rounded-full border border-premium-gold/40 px-5 font-classic-body text-sm text-premium-gold"
            >
              End Chess Time (Parent PIN)
            </button>
          ) : (
            <ParentPinEntry
              title="Enter Parent PIN"
              subtitle="This ends Chess Time on this device."
              submitLabel="End Chess Time"
              onSubmit={async (pin) => {
                const r = await endChessTimeWithPin(pin);
                if (r.ok) setShowExitPin(false);
                return r;
              }}
              onCancel={() => setShowExitPin(false)}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <p className={TEXT.subheading}>Duration</p>
            <div className="flex flex-wrap gap-2">
              {CHESS_TIME_DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={`min-h-[44px] rounded-full px-4 font-classic-body text-sm border ${
                    duration === m
                      ? "bg-premium-gold text-premium-midnight border-premium-gold"
                      : "border-white/15 text-premium-ivory/80"
                  }`}
                >
                  {m} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDuration(-1)}
                className={`min-h-[44px] rounded-full px-4 font-classic-body text-sm border ${
                  duration === -1
                    ? "bg-premium-gold text-premium-midnight border-premium-gold"
                    : "border-white/15 text-premium-ivory/80"
                }`}
              >
                Custom
              </button>
            </div>
            {duration === -1 && (
              <input
                type="number"
                min={1}
                max={180}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-32 rounded-premiumBtn px-3 py-2 border border-white/15 bg-premium-midnightDeep text-premium-ivory"
                aria-label="Custom minutes"
              />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <p className={TEXT.subheading}>Allowed during Chess Time</p>
            <div className="flex flex-col gap-2">
              {CHESS_TIME_ACTIVITIES.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 rounded-premiumBtn bg-premium-midnightDeep px-4 py-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => toggleActivity(a.id)}
                    className="h-5 w-5 accent-premium-gold"
                  />
                  <span className="text-xl">{a.emoji}</span>
                  <span className="font-classic-body text-sm text-premium-ivory">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={selected.length === 0}
            className="min-h-[48px] rounded-full bg-premium-gold font-classic-body text-sm font-semibold text-premium-midnight disabled:opacity-40"
          >
            Start Chess Time
          </button>
        </>
      )}

      <ScreenPinningGuide />

      <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
        <p className={TEXT.subheading}>Parent PIN</p>
        {!showChangePin ? (
          <button
            type="button"
            onClick={() => setShowChangePin(true)}
            className="self-start text-sm text-premium-gold underline underline-offset-4"
          >
            Change PIN
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Current PIN"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              className="rounded-premiumBtn px-4 py-3 border border-white/15 bg-premium-midnightDeep text-center text-premium-ivory"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="New PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className="rounded-premiumBtn px-4 py-3 border border-white/15 bg-premium-midnightDeep text-center text-premium-ivory"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm new PIN"
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
              className="rounded-premiumBtn px-4 py-3 border border-white/15 bg-premium-midnightDeep text-center text-premium-ivory"
            />
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const r = await changeParentPin(currentPin, newPin, confirmNewPin);
                  setPinMsg(r.ok ? "PIN updated." : r.error ?? "Could not update.");
                  if (r.ok) {
                    setShowChangePin(false);
                    setCurrentPin("");
                    setNewPin("");
                    setConfirmNewPin("");
                  }
                })();
              }}
              className="min-h-[44px] rounded-full bg-premium-gold/20 border border-premium-gold/40 text-premium-gold text-sm"
            >
              Save new PIN
            </button>
            {pinMsg && <p className={TEXT.caption}>{pinMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Child-facing Chess Time home content. */
export function ChessTimeHomePanel() {
  const { session, expired, remainingLabel, endChessTimeWithPin } = useChessTime();
  const [showExit, setShowExit] = useState(false);

  if (!session?.active) return null;

  if (expired) {
    return (
      <div className="w-full flex flex-col items-center gap-4 text-center py-8">
        <p className="text-5xl">♟</p>
        <h1 className={TEXT.display}>Chess Time is complete!</h1>
        <p className={TEXT.body}>Great job today.</p>
        {!showExit ? (
          <button
            type="button"
            onClick={() => setShowExit(true)}
            className="min-h-[44px] rounded-full border border-premium-gold/40 px-6 text-premium-gold text-sm"
          >
            Parent: exit with PIN
          </button>
        ) : (
          <ParentPinEntry
            title="Parent PIN"
            subtitle="A grown-up can end Chess Time here."
            submitLabel="Exit"
            onSubmit={async (pin) => {
              const r = await endChessTimeWithPin(pin);
              if (r.ok) setShowExit(false);
              return r;
            }}
            onCancel={() => setShowExit(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="text-center">
        <p className="text-5xl mb-2">♟</p>
        <h1 className={TEXT.display}>Chess Time</h1>
        <p className={`${TEXT.body} mt-2`}>Your chess adventure is ready.</p>
        <p className="font-classic-display text-3xl tabular-nums text-premium-gold mt-4">
          {remainingLabel}
        </p>
        <p className={`${TEXT.caption} normal-case mt-2`}>Time remaining</p>
      </div>
      <ChessTimeActivityLinks />
      {!showExit ? (
        <button
          type="button"
          onClick={() => setShowExit(true)}
          className="self-center text-xs text-premium-ivory/50 underline underline-offset-4"
        >
          Parent exit
        </button>
      ) : (
        <ParentPinEntry
          title="Parent PIN"
          submitLabel="Exit Chess Time"
          onSubmit={async (pin) => {
            const r = await endChessTimeWithPin(pin);
            if (r.ok) setShowExit(false);
            return r;
          }}
          onCancel={() => setShowExit(false)}
        />
      )}
    </div>
  );
}
