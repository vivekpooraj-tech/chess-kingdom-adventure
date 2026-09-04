"use client";

import { useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Segmented } from "@/components/ui/Segmented";
import { CheckIcon, LockIcon, FlameIcon, PuzzlePieceIcon } from "@/components/nav/icons";
import { AVATARS } from "@/content/avatars";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section label="UI-2B primitive" title={title}>
      <Surface elevation="flat" className="flex flex-wrap items-center gap-4 p-5">
        {children}
      </Surface>
    </Section>
  );
}

export function UiGalleryClient() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedChips, setSelectedChips] = useState<Record<string, boolean>>({ forks: true });
  const [tab, setTab] = useState("overview");
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [ring, setRing] = useState(50);

  return (
    <Screen maxWidth="wide">
      <PageHeader
        title="UI-2B — Core primitives"
        subtitle="Dev-only gallery. No screen is migrated to these yet."
        breadcrumb="Dev / UI"
        action={
          <Button tone="system" size="md" onClick={() => setSheetOpen(true)}>
            Open Sheet
          </Button>
        }
      />

      <Group title="Surface">
        <Surface elevation="flat" className="w-40 p-4 text-sm">flat</Surface>
        <Surface elevation="raised" className="w-40 p-4 text-sm">raised (focal)</Surface>
        <Surface elevation="sunken" className="w-40 p-4 text-sm">sunken</Surface>
        <Surface elevation="warm" className="w-40 p-4 text-sm">warm (paper)</Surface>
        <Surface elevation="flat" interactive as="button" className="w-40 p-4 text-left text-sm">
          interactive →
        </Surface>
      </Group>

      <Group title="Button — variants (tone=system, size md)">
        <Button tone="system" variant="primary">Primary</Button>
        <Button tone="system" variant="secondary">Secondary</Button>
        <Button tone="system" variant="ghost">Ghost</Button>
        <Button tone="system" variant="danger">Danger</Button>
        <Button tone="system" variant="primary" disabled>Disabled</Button>
        <Button tone="system" variant="primary" loading>Loading</Button>
        <Button tone="system" variant="primary" leftIcon={<CheckIcon className="h-4 w-4" />}>With icon</Button>
      </Group>

      <Group title="Button — sizes (tone=system)">
        <Button tone="system" size="sm">sm 40</Button>
        <Button tone="system" size="md">md 44</Button>
        <Button tone="system" size="lg">lg 52</Button>
        <Button tone="system" size="md" block className="max-w-xs">block</Button>
      </Group>

      <Group title="Button — legacy tones (backward compat, unchanged)">
        <Button tone="premium">tone=premium</Button>
        <Button tone="premium" variant="secondary">premium secondary</Button>
        <Button tone="adventure">tone=adventure</Button>
      </Group>

      <Group title="Chip">
        <Chip tone="neutral">Neutral</Chip>
        <Chip tone="gold">PRO</Chip>
        <Chip tone="success">Solved</Chip>
        <Chip tone="danger">Missed</Chip>
        <Chip tone="info">Mate in 1</Chip>
        <Chip tone="neutral" size="sm">SOON</Chip>
        <Chip tone="gold" icon={<FlameIcon className="h-3.5 w-3.5" />}>Streak +3</Chip>
        {(["forks", "pins", "skewers"] as const).map((c) => (
          <Chip
            key={c}
            selectable
            selected={!!selectedChips[c]}
            onClick={() => setSelectedChips((s) => ({ ...s, [c]: !s[c] }))}
          >
            {c}
          </Chip>
        ))}
        <Chip tone="neutral" onRemove={() => {}}>Removable</Chip>
      </Group>

      <Group title="Avatar">
        {(["xs", "sm", "md", "lg"] as const).map((sz) => (
          <Avatar key={sz} size={sz} emoji={AVATARS[0].emoji} colorFrom={AVATARS[0].colorFrom} colorTo={AVATARS[0].colorTo} alt="Knight Kid" />
        ))}
        <Avatar size="md" initial="Ollie" />
        <Avatar size="md" src="/does-not-exist.png" alt="fallback" initial="X" />
        <Avatar size="md" ring emoji="🦉" alt="Ollie" />
      </Group>

      <Group title="ProgressRing">
        <ProgressRing value={0} size="sm" showValue />
        <ProgressRing value={ring} size="md" showValue label="Day" />
        <ProgressRing value={100} size="lg" showValue />
        <input
          type="range"
          min={0}
          max={100}
          value={ring}
          onChange={(e) => setRing(Number(e.target.value))}
          aria-label="ring value"
          className="w-40"
        />
      </Group>

      <Group title="EmptyState">
        <div className="w-full max-w-sm">
          <EmptyState
            tone="neutral"
            media={<PuzzlePieceIcon className="h-6 w-6" />}
            title="Nothing here yet"
            description="Solve a puzzle and it'll show up in your history."
          />
        </div>
        <div className="w-full max-w-sm">
          <EmptyState
            tone="encouraging"
            media={<span className="text-xl">🦉</span>}
            title="No lessons completed yet"
            description="Start Day 1 and Ollie will meet you there."
            action={<Button tone="system" size="sm">Start Day 1</Button>}
          />
        </div>
      </Group>

      <Group title="ErrorState">
        <div className="w-full max-w-md">
          <ErrorState variant="page" onRetry={() => {}} description="That didn't load. Give it another try." />
        </div>
        <div className="w-full max-w-md">
          <ErrorState variant="inline" title="Couldn't save" description="Check your connection." onRetry={() => {}} />
        </div>
      </Group>

      <Group title="Tabs">
        <div className="w-full">
          <Tabs
            id="gallery"
            ariaLabel="Gallery sections"
            value={tab}
            onChange={setTab}
            items={[
              { value: "overview", label: "Overview" },
              { value: "achievements", label: "Achievements" },
              { value: "customize", label: "Customize" },
              { value: "locked", label: "Locked", disabled: true },
            ]}
          />
          <div className="pt-4">
            <TabPanel tabsId="gallery" value="overview" activeValue={tab}>
              <p className="text-sm text-text-secondary">Overview panel content.</p>
            </TabPanel>
            <TabPanel tabsId="gallery" value="achievements" activeValue={tab}>
              <p className="text-sm text-text-secondary">Achievements panel content.</p>
            </TabPanel>
            <TabPanel tabsId="gallery" value="customize" activeValue={tab}>
              <p className="text-sm text-text-secondary">Customize panel content.</p>
            </TabPanel>
          </div>
        </div>
      </Group>

      <Group title="Segmented">
        <Segmented
          ariaLabel="Example"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "a", label: "Bullet" },
            { value: "b", label: "Blitz" },
            { value: "c", label: "Rapid" },
          ]}
        />
        <Segmented
          ariaLabel="Example small"
          size="sm"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "a", label: "All" },
            { value: "b", label: "Tactics" },
            { value: "c", label: "Endgame" },
          ]}
        />
      </Group>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Example Sheet"
        footer={<Button tone="system" block onClick={() => setSheetOpen(false)}>Done</Button>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Bottom sheet on phone, right-edge panel on tablet/desktop. Escape closes; focus is
            trapped; the page body is scroll-locked.
          </p>
          {Array.from({ length: 20 }).map((_, i) => (
            <Surface key={i} elevation="sunken" className="p-3 text-sm">
              Scrollable row {i + 1}
            </Surface>
          ))}
          <Chip tone="gold">
            <LockIcon className="h-3.5 w-3.5" /> nested content works
          </Chip>
        </div>
      </Sheet>
    </Screen>
  );
}
