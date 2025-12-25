import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import dns from "dns";

import { requireAuth } from "@/lib/auth";

type HostCheck = {
  host: string;
  label: string;
  ok: boolean;
  address?: string;
  family?: number;
  error?: string;
};

function parseDbHost(): string | null {
  if (process.env.PGHOST) return process.env.PGHOST;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    // url parser understands postgres:// and postgresql://
    const parsed = new URL(url.replace("postgresql://", "postgres://"));
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

async function resolveHost(host: string, label: string): Promise<HostCheck> {
  try {
    const res = await dns.promises.lookup(host);
    return { host, label, ok: true, address: res.address, family: res.family };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { host, label, ok: false, error: message };
  }
}

// Lightweight health check for DNS resolution used by FastF1 + DB
export async function GET(request: NextRequest) {
  // Require admin auth (session cookie or API token)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin-session");
  if (!sessionCookie) {
    const authError = requireAuth(request);
    if (authError) return authError;
  }

  const dbHost = parseDbHost();
  const hosts: { host: string; label: string }[] = [
    { host: "api.formula1.com", label: "F1 API" },
    { host: "livetiming.formula1.com", label: "F1 Live Timing" },
    { host: "google.com", label: "Google DNS sanity check" },
  ];

  if (dbHost) hosts.push({ host: dbHost, label: "Postgres host" });

  const results = await Promise.all(hosts.map((h) => resolveHost(h.host, h.label)));

  return NextResponse.json({
    success: true,
    dns: results,
    env: {
      http_proxy: process.env.HTTP_PROXY || null,
      https_proxy: process.env.HTTPS_PROXY || null,
      no_proxy: process.env.NO_PROXY || null,
    },
  });
}
