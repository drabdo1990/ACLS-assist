import { WeightControl } from '../components/crisis/WeightControl';
import { LastCard } from '../components/crisis/LastCard';
import { MhCard } from '../components/crisis/MhCard';
import { CicoCard } from '../components/crisis/CicoCard';
import { MaternalCard } from '../components/crisis/MaternalCard';

/** View 2 — critical crisis action cards with dynamic weight scaling. */
export function CrisisScreen() {
  return (
    <div className="flex flex-col gap-3">
      <WeightControl />
      <LastCard />
      <MhCard />
      <CicoCard />
      <MaternalCard />
    </div>
  );
}
