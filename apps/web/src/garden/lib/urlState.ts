/**
 * The view, in the address bar.
 *
 * "Look at the top plan's bed in March 2025, filtered to wilting" was
 * previously a sentence you had to say to someone over their shoulder. Now it
 * is a link, and a reload puts you back where you were standing instead of at
 * the default view of today.
 *
 * Written with `replaceState`: scrubbing a timeline should not fill the back
 * button with three years of months.
 *
 * `?view=` is gone with the globe views it named, and `?plot=` with the ring
 * layout. Neither is read nor written, so a link still carrying `?view=globe`
 * or `?plot=rings` lands on the garden as it is — which is now the only thing
 * there is to land on.
 */

export interface UrlState {
  /** Which metric the beds are planted as. Absent means revenue. */
  metric: string | null;
  /** How subscriptions are drawn. Absent means trees. */
  shape: 'tree' | 'city' | 'aquarium';
  month: number | null;
  tier: string | null;
  health: string | null;
  stage: string | null;
  query: string;
  selected: string | null;
}

export const EMPTY_URL_STATE: UrlState = {
  metric: null,
  shape: 'tree',
  month: null,
  tier: null,
  health: null,
  stage: null,
  query: '',
  selected: null,
};

export function readUrlState(): UrlState {
  if (typeof window === 'undefined') return EMPTY_URL_STATE;

  const params = new URLSearchParams(window.location.search);
  const month = Number(params.get('m'));

  return {
    metric: params.get('metric'),
    // `cube` is what the city used to be called. Links are a documented
    // feature of this app — "a view is a link" — so an old one still lands.
    shape:
      params.get('shape') === 'city' || params.get('shape') === 'cube'
        ? 'city'
        : params.get('shape') === 'aquarium'
        ? 'aquarium'
        : 'tree',
    month: params.has('m') && Number.isInteger(month) && month >= 0 ? month : null,
    tier: params.get('tier'),
    health: params.get('health'),
    stage: params.get('stage'),
    query: params.get('q') ?? '',
    selected: params.get('sel'),
  };
}

export function writeUrlState(state: UrlState) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();
  if (state.metric && state.metric !== 'mrr') params.set('metric', state.metric);
  if (state.shape !== 'tree') params.set('shape', state.shape);
  if (state.month !== null) params.set('m', String(state.month));
  if (state.tier && state.tier !== 'All') params.set('tier', state.tier);
  if (state.health && state.health !== 'All') params.set('health', state.health);
  if (state.stage && state.stage !== 'All') params.set('stage', state.stage);
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.selected) params.set('sel', state.selected);

  const search = params.toString();
  const next = `${window.location.pathname}${search ? `?${search}` : ''}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', next);
  }
}
