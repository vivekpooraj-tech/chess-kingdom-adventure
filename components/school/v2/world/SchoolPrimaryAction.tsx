"use client";

import Link from "next/link";
import type { SchoolSession } from "@/content/school/types";
import type { WorldId } from "@/lib/world/worlds";
import { schoolStartLabel } from "@/lib/school/schoolArena";
import { canOpenSession, type SchoolAccess } from "@/lib/school/v2/access";
import { GRADUATE_HREF, sessionHref } from "../SessionRunner";
import { SchoolCta } from "../SchoolCta";
import { UnlockSchoolButton } from "../UnlockSchoolButton";

export function SchoolPrimaryAction({
  world,
  next,
  graduated,
  done,
  access,
}: {
  world: WorldId;
  next: SchoolSession | null;
  graduated: boolean;
  done: number;
  access: SchoolAccess;
}) {
  if (graduated) {
    return (
      <Link href={GRADUATE_HREF}>
        <SchoolCta block>See your certificate</SchoolCta>
      </Link>
    );
  }
  if (!next) return null;
  if (!canOpenSession(access, next.number)) {
    return <UnlockSchoolButton nextSessionNumber={next.number} />;
  }
  return (
    <Link href={sessionHref(next.id, world)}>
      <SchoolCta block>{schoolStartLabel(world, next.number, done === 0)}</SchoolCta>
    </Link>
  );
}
