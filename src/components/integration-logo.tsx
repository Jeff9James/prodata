"use client";

import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

interface IntegrationLogoProps {
  /** Integration ID (e.g. "stripe") or name (e.g. "Stripe") — matched case-insensitively */
  integration: string;
  className?: string;
  /** Size in px. Defaults to 16. */
  size?: number;
}

/**
 * Renders the real brand logo SVG for known integrations.
 * Falls back to a generic Lucide icon for unknown ones.
 *
 * When adding a new integration, add its logo SVG here.
 */
export function IntegrationLogo({
  integration,
  className,
  size = 16,
}: IntegrationLogoProps) {
  const key = integration.toLowerCase();

  const logo = LOGOS[key];
  if (logo) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: size, height: size }}
        aria-label={`${integration} logo`}
        role="img"
      >
        {logo(size)}
      </span>
    );
  }

  // Fallback
  return (
    <BarChart3
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label={`${integration} icon`}
    />
  );
}

// ─── Logo registry ───────────────────────────────────────────────────────────
// Each entry is a function that takes size and returns an SVG element.
// Colors use "currentColor" where appropriate so they adapt to context,
// or the official brand color when it should stay fixed.

const LOGOS: Record<string, (size: number) => React.ReactNode> = {
  stripe: (size) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#635BFF" />
      <path
        d="M11.2 9.65c0-.68.56-1.02 1.47-1.02.98 0 2.22.3 3.2.83V6.52a8.44 8.44 0 0 0-3.2-.6c-2.62 0-4.36 1.37-4.36 3.66 0 3.57 4.9 3 4.9 4.54 0 .81-.7 1.07-1.68 1.07-1.45 0-2.63-.6-3.5-1.42v3.04a8.9 8.9 0 0 0 3.5.74c2.68 0 4.52-1.32 4.52-3.65-.01-3.85-4.85-3.17-4.85-4.25Z"
        fill="white"
      />
    </svg>
  ),

  gumroad: (size) => (
    <img
      src="/gumroad-logomark.png"
      alt=""
      width={size}
      height={size}
      style={{ display: "block" }}
      loading="lazy"
      decoding="async"
    />
  ),

  revenuecat: (size) => (
    <img
      src="/revenuecat-logomark.svg"
      alt=""
      width={size}
      height={size}
      style={{ display: "block" }}
      loading="lazy"
      decoding="async"
    />
  ),

  mixpanel: (size) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#7856FF" />
      <circle cx="8" cy="12" r="2.5" fill="white" />
      <circle cx="16" cy="12" r="2.5" fill="white" />
    </svg>
  ),

  appstoreconnect: (size) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#007AFF" />
      <path
        d="M12 6l5.5 9.5h-3L12 11l-2.5 4.5h-3L12 6Z"
        fill="white"
      />
      <path
        d="M6.5 17h4l-1-1.73H7.5L6.5 17Zm7 0h4l-1-1.73h-2L13.5 17Z"
        fill="white"
        opacity="0.7"
      />
    </svg>
  ),

  amazon: (size) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="4" fill="#FF9900" />
      <path
        d="M12.48 13.14c-1.78 1.31-4.36 2.01-6.58 2.01-3.12 0-5.93-1.15-8.06-3.06-.17-.15-.02-.36.18-.24 2.3 1.34 5.14 2.14 8.07 2.14 1.98 0 4.15-.41 6.15-1.26.3-.13.56.2.26.41h-.02Z"
        fill="#232F3E"
        transform="translate(3.5, 2) scale(0.7)"
      />
      <path
        d="M13.2 12.38c-.23-.29-1.5-.14-2.08-.07-.17.02-.2-.13-.04-.24 1.01-.72 2.68-.51 2.88-.27.2.24-.05 1.91-1 2.71-.15.12-.29.06-.22-.11.22-.54.7-1.76.47-2.02h-.01Z"
        fill="#232F3E"
        transform="translate(3.5, 2) scale(0.7)"
      />
      <path
        d="M11.9 6.5v-.83c0-.13.1-.22.22-.22h3.92c.13 0 .23.09.23.22v.71c0 .13-.11.3-.31.57l-2.13 3.04c.79-.02 1.63.1 2.35.5.16.09.21.23.22.36v.89c0 .14-.15.3-.3.22-1.26-.66-2.93-.73-4.32.01-.14.08-.29-.08-.29-.22v-.84c0-.15.01-.41.15-.61l2.47-3.54h-2.15c-.13 0-.23-.09-.23-.22l.04-.04Z"
        fill="#232F3E"
        transform="translate(3.5, 2) scale(0.7)"
      />
      <path
        d="M4.7 14.3c-.13 0-.22-.1-.22-.23V7.23c0-.13.1-.24.23-.24h1.26c.13 0 .23.11.23.24v.53c.39-.52.98-.86 1.95-.86.6 0 1.19.22 1.57.82.1.15.27.2.41.08l.73-.64c.12-.1.1-.28 0-.4C10 5.92 8.73 5.5 7.47 5.5c-1.64 0-3 .64-3.83 2.09V5.43c0-.13-.1-.23-.23-.23H2.16c-.13 0-.23.1-.23.23v8.64c0 .13.1.23.23.23h2.5c.13 0 .23-.1.23-.23V9.7c0-1.33.66-2.51 2-2.51 1.33 0 1.77 1.05 1.77 2.37v4.51c0 .13-.1.23-.23.23H4.7Z"
        fill="#232F3E"
        transform="translate(3.5, 2) scale(0.7)"
      />
    </svg>
  ),
};

/**
 * Returns the list of integration IDs that have real logos.
 * Useful for feature-gating or display logic.
 */
export function hasIntegrationLogo(integration: string): boolean {
  return integration.toLowerCase() in LOGOS;
}
