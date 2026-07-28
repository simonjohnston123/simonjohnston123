"use client";

import { useRouter } from "next/navigation";

export function LocationSwitcher({
  current,
  locations,
}: {
  current: string;
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <select
      className="input mb-4 text-sm font-medium"
      value={current}
      onChange={(e) => router.push(`/dashboard/l/${e.target.value}`)}
    >
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
