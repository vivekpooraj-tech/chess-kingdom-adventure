"use client";

import Link from "next/link";
import { FUNDAMENTALS_TOPICS } from "@/content/academyFundamentals";
import { ChessBoard } from "@/components/board/ChessBoard";
import { PrimaryNav } from "@/components/nav/PrimaryNav";
import { SecondaryCard } from "@/components/ui/Card";
import { TEXT } from "@/lib/designSystem";

export default function FundamentalsPage() {
  return (
    <>
      <main className="min-h-screen bg-premium-midnight flex flex-col items-center gap-6 px-6 pt-10 pb-24">
        <div className="text-center max-w-md">
          <h1 className={TEXT.display}>Chess Fundamentals</h1>
          <p className={`${TEXT.body} mt-2`}>
            The board, the pieces, and the rules that hold it all together.
          </p>
        </div>

        <div className="w-full max-w-md flex flex-col gap-4">
          {FUNDAMENTALS_TOPICS.map((topic, i) => (
            <SecondaryCard key={topic.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="font-classic-body text-[10px] font-semibold text-premium-gold border border-premium-gold/30 rounded-full w-5 h-5 flex items-center justify-center flex-none">
                  {i + 1}
                </span>
                <h2 className={TEXT.subheading}>{topic.title}</h2>
              </div>
              <p className={TEXT.body}>{topic.explanation}</p>
              {topic.exampleFen && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <ChessBoard fen={topic.exampleFen} size={240} readOnly />
                  {topic.exampleCaption && (
                    <p className={`${TEXT.caption} text-center italic normal-case`}>
                      {topic.exampleCaption}
                    </p>
                  )}
                </div>
              )}
            </SecondaryCard>
          ))}
        </div>

        <Link
          href="/academy"
          className="font-body text-sm text-premium-ivory/40 underline underline-offset-2"
        >
          Back to the Academy
        </Link>
      </main>
      <PrimaryNav />
    </>
  );
}
