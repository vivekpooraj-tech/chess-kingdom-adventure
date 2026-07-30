"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function UpgradeButton({ label = "Unlock Everything — $29.99" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Couldn't start checkout.");
        setLoading(false);
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={startCheckout} disabled={loading}>
        {loading ? "Starting checkout..." : label}
      </Button>
      {error && <p className="font-body text-sm text-kingdom-coral">{error}</p>}
    </div>
  );
}
