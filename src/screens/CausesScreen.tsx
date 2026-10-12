import { useCodeStore } from '../engine/store';
import { CausesGrid } from '../components/causes/CausesGrid';
import { PocusChecklist } from '../components/causes/PocusChecklist';
import { PostRoscBundle } from '../components/causes/PostRoscBundle';

/** Screen 2 — reversible causes, POCUS, and (after ROSC) the post-ROSC bundle on top. */
export function CausesScreen() {
  const rosc = useCodeStore((s) => s.status === 'rosc');

  return (
    <div className="flex flex-col gap-3">
      {rosc ? <PostRoscBundle /> : null}
      <CausesGrid />
      <PocusChecklist />
      {rosc ? null : <PostRoscBundle />}
    </div>
  );
}
