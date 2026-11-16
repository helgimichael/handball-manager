// Arena Nights TRN-01f (A: skeleton grid): Suspense fallback with the same
// header and 7-day grid geometry as the planner, so nothing jumps on load.
import { DAY_SHORT } from "./weekParts";

export default function TrainingWeekSkeleton() {
  return (
    <div className="hm-training-screen trn-skeleton" role="status" aria-live="polite">
      <span className="trn-sr">Förbereder träningsveckan…</span>
      <div className="trn-sk trn-sk-banner" aria-hidden="true" />
      <div className="trn-sk trn-sk-assistant" aria-hidden="true" />
      <div className="trn-main" aria-hidden="true">
        <div className="hm-panel trn-planner">
          <div className="trn-week-scroll">
            <div className="trn-week">
              {DAY_SHORT.map((d) => (
                <div key={d} className="trn-day">
                  <div className="trn-day-head"><span className="trn-day-name">{d}</span><span className="trn-sk trn-sk-num" /></div>
                  <span className="trn-sk trn-sk-line" />
                  <span className="trn-sk trn-sk-block" />
                  <span className="trn-sk trn-sk-block" data-short />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="hm-panel trn-forecast"><span className="trn-sk trn-sk-line" /><span className="trn-sk trn-sk-block" /><span className="trn-sk trn-sk-block" /></div>
      </div>
    </div>
  );
}
