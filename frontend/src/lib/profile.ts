import type { ClientProfile } from "@/lib/api";

export type ProfileMap = Record<string, ClientProfile | undefined>;

export function buildProfileMap(profiles: ClientProfile[] | undefined): ProfileMap {
  const map: ProfileMap = {};
  for (const p of profiles ?? []) {
    map[p.client_id] = p;
  }
  return map;
}

/** Human-friendly display name. Prefers "Company / Person" then falls back to client_id. */
export function displayName(
  clientId: string,
  profile: ClientProfile | undefined,
): string {
  if (!profile) return clientId;
  const parts = [profile.company, profile.person_name].filter(Boolean);
  if (parts.length === 0) return clientId;
  return parts.join(" / ");
}

/** Two-line display: title + (device) + id, used in tables. */
export function profileLines(
  clientId: string,
  profile: ClientProfile | undefined,
): { title: string; device: string | null; subtitle: string } {
  const name = displayName(clientId, profile);
  if (name === clientId) {
    return { title: clientId, device: profile?.device ?? null, subtitle: "" };
  }
  return {
    title: name,
    device: profile?.device ?? null,
    subtitle: clientId,
  };
}
