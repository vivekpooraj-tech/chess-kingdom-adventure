"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OPENINGS, OpeningDef, getOpeningFamily } from "@/content/openings";
import { getOpeningStatus, STATUS_LABELS, OpeningEncounterRow } from "@/lib/openings/practiceTracking";
import { TEXT } from "@/lib/designSystem";

type Filter = "all" | "e4" | "d4" | "c4" | "nf3" | "gambits" | "beginner" | "intermediate" | "advanced";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "e4", label: "1.e4" },
  { key: "d4", label: "1.d4" },
  { key: "c4", label: "1.c4" },
  { key: "nf3", label: "1.Nf3" },
  { key: "gambits", label: "Gambits" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

function matchesFilter(o: OpeningDef, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "gambits") return o.isGambit;
  if (filter === "beginner" || filter === "intermediate" || filter === "advanced") {
    return o.difficulty === filter;
  }
  return getOpeningFamily(o) === filter;
}

function matchesSearch(o: OpeningDef, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  if (o.name.toLowerCase().includes(q)) return true;
  if (o.alternativeName?.toLowerCase().includes(q)) return true;
  if (o.ecoCode.toLowerCase().includes(q)) return true;
  if (q === "gambit" && o.isGambit) return true;
  return false;
}

const STATUS_DOT_COLOR: Record<string, string> = {
  discovered: "bg-premium-ivory/40",
  studied: "bg-premium-gold/60",
  practiced: "bg-emerald-400/70",
  mastered: "bg-premium-gold",
};

export function OpeningExplorerClient({
  encounters,
}: {
  encounters: OpeningEncounterRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const encountersById = useMemo(() => new Map(encounters.map((e) => [e.opening_id, e])), [encounters]);

  const results = useMemo(
    () => OPENINGS.filter((o) => matchesFilter(o, filter) && matchesSearch(o, query)),
    [filter, query]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className={`${TEXT.meta} text-premium-gold`}>Chess Openings</p>
        <h1 className={`${TEXT.display} mt-1`}>Explore Chess Openings</h1>
        <p className={`${TEXT.body} mt-2`}>Discover how great games begin.</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, ECO code, or “gambit”..."
        aria-label="Search openings by name, ECO code, or gambit"
        className="w-full rounded-premiumBtn bg-premium-navy border border-white/10 px-4 py-2.5 font-classic-body text-sm text-premium-ivory placeholder:text-premium-ivory/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold/50 focus:border-premium-gold/50"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-none font-classic-body text-xs rounded-full px-3 py-1.5 border whitespace-nowrap transition-colors ${
              filter === f.key
                ? "border-premium-gold bg-premium-gold/10 text-premium-gold"
                : "border-white/10 text-premium-ivory/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {results.length === 0 && (
          <p className="font-classic-body text-sm text-premium-ivory/40 text-center py-8">
            No openings match “{query}”.
          </p>
        )}
        {results.map((o) => {
          const status = getOpeningStatus(encountersById.get(o.id) ?? null);
          return (
            <Link
              key={o.id}
              href={`/academy/openings/${o.id}`}
              className="flex items-center gap-3 rounded-premiumCard bg-premium-navy shadow-premiumCard px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-classic-display text-sm text-premium-ivory">{o.name}</p>
                  {o.isGambit && (
                    <span className="font-classic-body text-[9px] font-semibold text-red-300 border border-red-400/30 rounded-full px-1.5 py-0.5">
                      GAMBIT
                    </span>
                  )}
                </div>
                <p className="font-classic-body text-[11px] text-premium-ivory/40 mt-0.5">
                  {o.ecoCode} · {o.difficulty}
                </p>
              </div>
              {status && (
                <span className="flex items-center gap-1.5 font-classic-body text-[10px] text-premium-ivory/50 flex-none">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLOR[status]}`} />
                  {STATUS_LABELS[status]}
                </span>
              )}
              <span className="text-premium-gold text-lg flex-none">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
