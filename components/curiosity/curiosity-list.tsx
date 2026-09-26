import { CuriosityCard } from "./curiosity-card";
import type { CampaignWithDirection } from "@/lib/domain/campaign";
import type { Curiosity } from "@/lib/domain/curiosity";

export function CuriosityList({
  curiosities,
  campaigns,
}: {
  curiosities: Curiosity[];
  campaigns: CampaignWithDirection[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {curiosities.map((curiosity) => (
        <li key={curiosity.id}>
          <CuriosityCard curiosity={curiosity} campaigns={campaigns} />
        </li>
      ))}
    </ul>
  );
}
