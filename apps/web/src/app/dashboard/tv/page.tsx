import { TvView } from "../tv-view";

/**
 * The wall display.
 *
 * Nothing is resolved here. The plot reads its own book from `/api/garden`, and
 * `clean` mode draws no chrome that would need a name for it — no account, no
 * switcher, no title bar. Auth is the dashboard layout's, one level up.
 */
export default function TvPage() {
  return <TvView />;
}
