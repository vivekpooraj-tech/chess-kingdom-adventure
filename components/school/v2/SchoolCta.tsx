"use client";

import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import type { ComponentProps } from "react";

/**
 * Primary Chess School action. Same Button + routes; world tokens restyle
 * it via `.world-cta` (gold / crimson / forest) without a second school tree.
 */
export function SchoolCta({
  className,
  size = "lg",
  ...props
}: Omit<ComponentProps<typeof Button>, "tone">) {
  return (
    <Button
      tone="premium"
      size={size}
      className={clsx("world-cta min-h-[48px]", className)}
      {...props}
    />
  );
}
