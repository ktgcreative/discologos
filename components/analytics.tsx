"use client";

import { Analytics } from "@vercel/analytics/next";

const beforeSend: React.ComponentProps<typeof Analytics>["beforeSend"] = (event) =>
  event.type === "pageview" ? event : null;

export function PageViewAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
