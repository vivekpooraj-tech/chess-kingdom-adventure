// Minimal line icons for PrimaryNav — no icon library in this project, and
// five icons doesn't justify adding one. Single stroke, currentColor, same
// viewBox/weight across the set so they read as one family.

type IconProps = { className?: string };

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M5 4 L5 20 L19 12 Z" />
    </svg>
  );
}

export function KingdomIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 20 V8 H7 V5 H10.5 V8 H13.5 V5 H17 V8 H20 V20 Z" />
      <path d="M10 20 V15 H14 V20" />
    </svg>
  );
}

export function AcademyIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M12 6 C10 4.5 6.5 4 4 4.5 V17.5 C6.5 17 10 17.5 12 19 C14 17.5 17.5 17 20 17.5 V4.5 C17.5 4 14 4.5 12 6 Z" />
      <path d="M12 6 V19" />
    </svg>
  );
}

export function ChessMindIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M9 18 H15" />
      <path d="M10 21 H14" />
      <path d="M12 3 C8.5 3 6.5 5.5 6.5 8.5 C6.5 10.8 7.8 12 8.8 13.2 C9.5 14 10 14.8 10 16 H14 C14 14.8 14.5 14 15.2 13.2 C16.2 12 17.5 10.8 17.5 8.5 C17.5 5.5 15.5 3 12 3 Z" />
    </svg>
  );
}

export function DiscoverIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9 L13 13 L9 15 L11 11 Z" />
    </svg>
  );
}

export function ProfileIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20 C5 16 8 14 12 14 C16 14 19 16 19 20" />
    </svg>
  );
}

// --- Extended set (Phase 10B) — same family, used across the redesign for
// streaks, progress, and CTAs instead of reaching for emoji. Emoji stays
// for deliberate personality touches (celebrations, buddy avatars), not
// for structural UI like this.

export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M12 3 C12 6 9 7.5 9 11 C9 13.2 10.8 15 13 15 C15.2 15 17 13.2 17 11 C17 9.5 16 8.5 15.5 8 C15.7 9 15 10 14 10 C14.5 8 13.5 6.5 12 3 Z" />
      <path d="M9 14 C7.5 15.5 7 17 7 18.5 C7 20.9 9.2 21.5 12 21.5 C14.8 21.5 17 20.9 17 18.5 C17 17.3 16.5 16.3 15.8 15.3" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M7 4 H17 V9 C17 12 14.8 14 12 14 C9.2 14 7 12 7 9 Z" />
      <path d="M7 5.5 H4.5 C4.5 8 6 9.5 7.5 9.8" />
      <path d="M17 5.5 H19.5 C19.5 8 18 9.5 16.5 9.8" />
      <path d="M12 14 V17.5" />
      <path d="M8.5 20.5 H15.5 C15.5 18.5 14 17.5 12 17.5 C10 17.5 8.5 18.5 8.5 20.5 Z" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M9 5 L16 12 L9 19" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="5.5" y="11" width="13" height="9.5" rx="2" />
      <path d="M8 11 V8 C8 5.8 9.8 4 12 4 C14.2 4 16 5.8 16 8 V11" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M5 13 L10 18 L19 6" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </svg>
  );
}

// --- Cinematic video player controls (Phase 12) ---

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M8 5 V19" />
      <path d="M16 5 V19" />
    </svg>
  );
}

export function SoundOnIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 10 V14 H8 L13 18 V6 L8 10 Z" />
      <path d="M16.5 9 C17.5 10 17.5 14 16.5 15" />
      <path d="M19 7 C21 9 21 15 19 17" />
    </svg>
  );
}

export function SoundOffIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 10 V14 H8 L13 18 V6 L8 10 Z" />
      <path d="M17 9 L21 15" />
      <path d="M21 9 L17 15" />
    </svg>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M8 4 H4 V8" />
      <path d="M16 4 H20 V8" />
      <path d="M8 20 H4 V16" />
      <path d="M16 20 H20 V16" />
    </svg>
  );
}
