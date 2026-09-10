import type { ParentLockCapabilities, ParentLockPlatform } from "./types";

/**
 * Honest platform capability report for Parent Lock.
 *
 * Consumer apps cannot enable Android Screen Pinning or iOS Guided Access
 * programmatically without special entitlements. We guide parents instead.
 */
export function detectPlatformFromUserAgent(userAgent: string): ParentLockPlatform {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (typeof window !== "undefined") return "web";
  return "unknown";
}

export function buildParentLockCapabilities(input: {
  platform: ParentLockPlatform;
  lockTaskActive?: boolean;
}): ParentLockCapabilities {
  const { platform, lockTaskActive = false } = input;

  const limitations: string[] = [
    "Chess Time controls navigation inside Chess Mind only.",
    "It does not block YouTube, games, or other apps unless the parent enables device-level pinning separately.",
  ];

  if (platform === "ios") {
    limitations.push(
      "On iPhone and iPad, use Settings → Accessibility → Guided Access for device-level focus."
    );
  }

  if (platform === "android") {
    limitations.push(
      "On Android, enable Screen Pinning (or App Pinning) in Security settings — steps vary by manufacturer."
    );
  }

  return {
    platform,
    supportsScreenPinningGuidance: platform === "android",
    supportsLockTaskDetection: lockTaskActive,
    lockTaskActive,
    supportsTrueKioskMode: false,
    canLaunchPinningSettings: false,
    limitations,
  };
}

export function getDefaultCapabilities(userAgent = ""): ParentLockCapabilities {
  return buildParentLockCapabilities({
    platform: detectPlatformFromUserAgent(userAgent),
  });
}
