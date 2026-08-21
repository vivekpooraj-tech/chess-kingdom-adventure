"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isChessFocusActive, subscribeChessFocus } from "@/lib/chessFocus/focusMode";
import { PrimaryNav } from "./PrimaryNav";

const HIDDEN_PREFIXES = ["/kingdom-map/board-skin", "/kingdom-map/customize", "/kingdom-map/piece-set"];

export function TabShellNav() {
  const pathname = usePathname();
  const [focusActive, setFocusActive] = useState(false);

  useEffect(() => {
    setFocusActive(isChessFocusActive());
    return subscribeChessFocus(() => setFocusActive(isChessFocusActive()));
  }, []);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  if (focusActive) return null;
  return <PrimaryNav />;
}
