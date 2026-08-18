/**
 * Appearance: one light/dark axis, one seasonal axis.
 *
 * The garden used to be a single hardcoded July afternoon — vivid lime turf,
 * emerald canopies, a white HUD — baked into a dozen components as literal hex
 * strings. Two things were impossible as a result: reading the dashboard at
 * night, and letting the plot look like the month you are actually scrubbed to.
 *
 * Both are the same problem, so both are solved here. A theme is a (mode,
 * season) pair resolved into two token sets:
 *
 *   chrome — CSS custom properties for the HUD. Written to <html> once per
 *            change; every panel reads them through Tailwind's `bg-surface`,
 *            `text-ink`, `bg-garden` utilities, so no component knows a colour.
 *   canvas — pigments for the <canvas> renderer, which cannot read CSS
 *            variables cheaply on a 60fps loop and so takes plain hex.
 *
 * Seasons are not a colour filter over one drawing. Each carries its own turf,
 * canopy, light and weather — petals in spring, pollen in summer, leaf-fall in
 * autumn, snow that settles on the canopies in winter — and each is authored
 * twice, for day and for night, because a scene lit by the sun and one lit by
 * the moon do not share a palette.
 */

import { type PlanTier } from '../types';
import { planCatalogueVersion, planNames, planPosition, sampleRamp } from './plans';

export type ThemeMode = 'light' | 'dark' | 'system';
/** What `system` collapses to once the OS has been asked. */
export type ResolvedMode = 'light' | 'dark';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** `auto` follows the month the timeline is scrubbed to. */
export type SeasonPreference = Season | 'auto';

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/* ------------------------------------------------------------------ chrome */

/**
 * Every colour the HUD is allowed to have. Named for its job, not its hue, so
 * that "the accent" can be rust in October without a single component
 * mentioning October.
 */
export interface ChromeTokens {
  /** Page backdrop, top-left to bottom-right. */
  pageFrom: string;
  pageVia: string;
  pageTo: string;

  /** Floating panel fill (translucent) and its opaque sibling for modals. */
  surface: string;
  surfaceSolid: string;
  /** Recessed fill: inputs, muted chips, table zebra. */
  inset: string;
  insetStrong: string;
  hairline: string;

  ink: string;
  inkSoft: string;
  inkFaint: string;
  /** Text that sits on top of a solid `ink` fill. */
  inkInverse: string;

  scrim: string;
  shadowPanel: string;
  shadowModal: string;
  shadowToast: string;
  /** Slider rails, progress troughs. */
  track: string;

  accent: string;
  accentHover: string;
  /** Text/icon colour on an `accent` fill. */
  accentInk: string;
  /** Accent-coloured text on the page. */
  accentSoft: string;
  accentWash: string;
  accentLine: string;

  warn: string;
  warnInk: string;
  warnWash: string;
  warnLine: string;

  danger: string;
  dangerInk: string;
  dangerWash: string;
  dangerLine: string;

  info: string;
  infoInk: string;

  special: string;
  specialInk: string;

}

/* ------------------------------------------------------------------ canvas */

export type AmbientKind = 'petal' | 'mote' | 'leaf' | 'snow' | 'firefly' | 'star';

/** One drifting particle field. Seasons stack one or two of these. */
export interface AmbientLayer {
  kind: AmbientKind;
  count: number;
  colors: string[];
  /** Radius range in screen pixels. */
  size: [number, number];
  /** Fall speed range, px/frame. Negative rises. */
  speed: [number, number];
  /** Horizontal wander amplitude. */
  drift: number;
  opacity: number;
}

/** Scatter drawn onto the turf itself: blossom, tufts, leaf litter, snow. */
export interface LitterSpec {
  colors: string[];
  /** Chance per tile that a mark is drawn, 0–1. */
  density: number;
  size: number;
}

export interface CanvasTokens {
  turfA: string;
  turfB: string;
  turfLine: string;

  soilFront: string;
  soilSide: string;
  soilRim: string;
  groundShadow: string;

  /** Healthy canopy, before the plan ramp. The season's own green. */
  leaf: string;
  leafHighlight: string;
  blossom: string;

  /**
   * The healthy canopy per plan, as [base, highlight] — what a plant is
   * actually painted with. Derived from `leaf` by `planFoliage`, never
   * authored, so a season is still described in one place.
   */
  foliage: Record<PlanTier, [string, string]>;

  /**
   * Canopies for the four unhealthy states, as [base, highlight].
   *
   * Dunning is data, so it keeps one meaning across the year: a plant in
   * trouble must never be confusable with a healthy plant in a warm month.
   * Three seasons therefore share the amber ladder in `WOOD`. Autumn is the
   * exception and overrides it — its healthy foliage *is* amber, so the
   * warning has to move to crimson to stay a warning.
   */
  health: Record<'yellowing' | 'wilting' | 'browning' | 'recovered', [string, string]>;

  trunkStarter: string;
  trunkPro: string;
  trunkScale: string;
  trunkScaleRing: string;
  trunkEnterprise: string;
  seedHusk: string;
  seedStem: string;
  sproutLeaf: string;
  sproutStem: string;
  stumpBody: string;
  stumpTop: string;

  stakePost: string;
  stakeTagFill: string;
  stakeTagStroke: string;
  stakeTagText: string;

  tagFill: string;
  tagStroke: string;
  tagShadow: string;
  tagTitle: string;
  tagSub: string;
  tagAccent: string;
  tagStem: string;

  ringHover: string;
  ringMatch: string;
  ringMatchFill: string;

  rain: string;
  sunbeamFill: string;
  sunbeamRing: string;

  ambient: AmbientLayer[];
  litter: LitterSpec | null;
  /** Snow that settles on canopies. Null outside winter. */
  canopySnow: string | null;
  /** Directional light wash over the whole viewport. */
  sunWash: string | null;
  /** Corner darkening — night scenes only. */
  vignette: string | null;
}

export interface Theme {
  mode: ResolvedMode;
  season: Season;
  chrome: ChromeTokens;
  canvas: CanvasTokens;
}

/* ------------------------------------------------------- chrome definitions */

/** Neutral chrome. Seasons only move the accent; the paper stays the paper. */
const CHROME_NEUTRAL: Record<ResolvedMode, Omit<ChromeTokens,
  'pageFrom' | 'pageVia' | 'pageTo' |
  'accent' | 'accentHover' | 'accentInk' | 'accentSoft' | 'accentWash' | 'accentLine'>> = {
  light: {
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceSolid: '#FFFFFF',
    inset: '#F3F5F3',
    insetStrong: '#E6EAE7',
    hairline: 'rgba(15, 32, 23, 0.08)',

    ink: '#111A15',
    inkSoft: '#4B5A52',
    inkFaint: '#8B978F',
    inkInverse: '#FFFFFF',

    scrim: 'rgba(17, 26, 21, 0.20)',
    shadowPanel: '0 1px 2px rgba(15, 32, 23, 0.04), 0 8px 28px rgba(15, 32, 23, 0.07)',
    shadowModal: '0 10px 40px rgba(15, 32, 23, 0.12)',
    shadowToast: '0 2px 10px rgba(15, 32, 23, 0.14)',
    track: '#DDE3DF',

    warn: '#F59E0B',
    warnInk: '#A85D08',
    warnWash: '#FEF6E7',
    warnLine: 'rgba(245, 158, 11, 0.28)',

    danger: '#F43F5E',
    dangerInk: '#BE123C',
    dangerWash: '#FFF0F3',
    dangerLine: 'rgba(244, 63, 94, 0.26)',

    info: '#3B82F6',
    infoInk: '#1D4ED8',

    special: '#8B5CF6',
    specialInk: '#6D28D9',
  },
  dark: {
    // Neutral, and deliberately so. These panels used to be a desaturated
    // green-black, on the theory that a grey card over a green field reads as
    // a hole punched in the scene. At night that theory is wrong: what it
    // produces is not a dark theme but a *green* one, and it stains everything
    // the reader is looking through — chrome, page and turf alike. The season
    // has better ways to speak than by tinting the room.
    //
    // Neutral means *achromatic*, which is the part this kept getting wrong.
    // These were struck blue-grey (a #17191C panel at hue ~225), then warm
    // (hue 68) to fix that, which is the same mistake with the temperature
    // reversed. Both stain the room. Every grey here is now a pure step —
    // no hue, no chroma — and the only colour in the dark chrome is the
    // accent and the status family, which is the point of an accent.
    //
    // These are the same values as the host app's `.dark`, restruck as hex
    // because the canvas cannot read a CSS variable on a 60fps loop. The
    // pre-paint fallback in `index.css` under `:root[data-mode='dark']` is a
    // copy of this block and has to be kept in step with it.
    surface: 'rgba(23, 23, 23, 0.88)',
    surfaceSolid: '#171717',
    inset: 'rgba(255, 255, 255, 0.055)',
    insetStrong: 'rgba(255, 255, 255, 0.10)',
    hairline: 'rgba(255, 255, 255, 0.11)',

    ink: '#E9E9E9',
    inkSoft: '#B5B5B5',
    inkFaint: '#8F8F8F',
    inkInverse: '#0A0A0A',

    scrim: 'rgba(0, 0, 0, 0.62)',
    shadowPanel: '0 1px 2px rgba(0, 0, 0, 0.45), 0 12px 36px rgba(0, 0, 0, 0.48)',
    shadowModal: '0 16px 56px rgba(0, 0, 0, 0.62)',
    shadowToast: '0 2px 14px rgba(0, 0, 0, 0.55)',
    track: 'rgba(255, 255, 255, 0.14)',

    warn: '#F59E0B',
    warnInk: '#FBBF24',
    warnWash: 'rgba(245, 158, 11, 0.14)',
    warnLine: 'rgba(245, 158, 11, 0.30)',

    danger: '#F43F5E',
    dangerInk: '#FB7185',
    dangerWash: 'rgba(244, 63, 94, 0.14)',
    dangerLine: 'rgba(244, 63, 94, 0.30)',

    info: '#60A5FA',
    infoInk: '#93C5FD',

    special: '#A78BFA',
    specialInk: '#C4B5FD',
  },
};

type AccentSet = Pick<ChromeTokens,
  'accent' | 'accentHover' | 'accentInk' | 'accentSoft' | 'accentWash' | 'accentLine' |
  'pageFrom' | 'pageVia' | 'pageTo'>;

/**
 * **The light page is one colour in every season.**
 *
 * It used to be a per-season gradient — spring's page was a shade greener than
 * summer's — which is a lovely idea and the wrong one for an app whose pages are
 * mostly *not* the plot: the ledger, the inbox and settings all sit on this
 * gradient too, and a settings page whose background drifts with the month the
 * scrubber happens to be parked on is a background nobody can rely on. The plot
 * still says what season it is where seasons belong: the turf, the foliage, the
 * air, the litter.
 *
 * Dark mode is untouched. `#E2F4E8` is a pale mint; used behind white ink it would
 * be a light theme with the lights off.
 */
const CHROME_SEASON: Record<Season, Record<ResolvedMode, AccentSet>> = {
  spring: {
    light: {
      pageFrom: '#E2F4E8', pageVia: '#E2F4E8', pageTo: '#E2F4E8',
      accent: '#3E9E5B', accentHover: '#34884D', accentInk: '#FFFFFF',
      accentSoft: '#1F6B39', accentWash: '#EDF7EE', accentLine: 'rgba(62, 158, 91, 0.28)',
    },
    dark: {
      pageFrom: '#0A0A0A', pageVia: '#0A0A0A', pageTo: '#0A0A0A',
      accent: '#57C87A', accentHover: '#6BD68B', accentInk: '#08150D',
      accentSoft: '#7FD79A', accentWash: 'rgba(87, 200, 122, 0.14)', accentLine: 'rgba(87, 200, 122, 0.30)',
    },
  },
  summer: {
    light: {
      pageFrom: '#E2F4E8', pageVia: '#E2F4E8', pageTo: '#E2F4E8',
      accent: '#059669', accentHover: '#047857', accentInk: '#FFFFFF',
      accentSoft: '#047857', accentWash: '#ECFDF5', accentLine: 'rgba(5, 150, 105, 0.28)',
    },
    dark: {
      pageFrom: '#0A0A0A', pageVia: '#0A0A0A', pageTo: '#0A0A0A',
      accent: '#34D399', accentHover: '#4FE0AB', accentInk: '#04160E',
      accentSoft: '#5EEAD4', accentWash: 'rgba(52, 211, 153, 0.14)', accentLine: 'rgba(52, 211, 153, 0.30)',
    },
  },
  autumn: {
    light: {
      pageFrom: '#E2F4E8', pageVia: '#E2F4E8', pageTo: '#E2F4E8',
      accent: '#C2661F', accentHover: '#A9561A', accentInk: '#FFFFFF',
      accentSoft: '#9A4E17', accentWash: '#FBF1E4', accentLine: 'rgba(194, 102, 31, 0.28)',
    },
    dark: {
      pageFrom: '#0A0A0A', pageVia: '#0A0A0A', pageTo: '#0A0A0A',
      accent: '#E8913C', accentHover: '#F2A253', accentInk: '#1A0F05',
      accentSoft: '#F0AC63', accentWash: 'rgba(232, 145, 60, 0.14)', accentLine: 'rgba(232, 145, 60, 0.30)',
    },
  },
  winter: {
    light: {
      pageFrom: '#E2F4E8', pageVia: '#E2F4E8', pageTo: '#E2F4E8',
      accent: '#2C7DAF', accentHover: '#246A97', accentInk: '#FFFFFF',
      accentSoft: '#215F87', accentWash: '#EDF5FA', accentLine: 'rgba(44, 125, 175, 0.28)',
    },
    dark: {
      pageFrom: '#0A0A0A', pageVia: '#0A0A0A', pageTo: '#0A0A0A',
      accent: '#63B6E3', accentHover: '#7BC5EA', accentInk: '#05141E',
      accentSoft: '#93CDEE', accentWash: 'rgba(99, 182, 227, 0.14)', accentLine: 'rgba(99, 182, 227, 0.30)',
    },
  },
};

type GroundTokens = Pick<CanvasTokens,
  'turfA' | 'turfB' | 'turfLine' | 'soilFront' | 'soilSide' | 'soilRim' | 'groundShadow'>;

/**
 * The ground in the dark — the same lawn as the day, at night.
 *
 * The beds are most of the pixels on screen, so their hue *is* the theme: a
 * neutral grey-black slab reads as a model of a garden rather than a garden
 * after dark. Each season's dark turf is its light turf taken down in value and
 * a little in chroma — spring yellow-green, summer green, autumn olive, winter
 * still the cool snow-grey it is at noon — and the soil stays brown, because
 * earth does not turn grey when the sun goes down.
 *
 * Value contrast is the constraint, not hue: the top face has to out-value the
 * cut edges or the slab stops reading as a solid, and bark (WOOD.dark) has to
 * out-value the turf or the trees lose their stems. Everything the season says
 * elsewhere — foliage, ambient, accent — is untouched.
 */
const DARK_GROUND: Record<Season, GroundTokens> = {
  spring: {
    turfA: '#313F29', turfB: '#2C3924', turfLine: 'rgba(255, 255, 255, 0.06)',
    soilFront: '#241A12', soilSide: '#1B130D', soilRim: 'rgba(255, 255, 255, 0.08)',
    groundShadow: 'rgba(0, 0, 0, 0.45)',
  },
  summer: {
    turfA: '#2A3C25', turfB: '#253620', turfLine: 'rgba(255, 255, 255, 0.06)',
    soilFront: '#221811', soilSide: '#19110C', soilRim: 'rgba(255, 255, 255, 0.08)',
    groundShadow: 'rgba(0, 0, 0, 0.45)',
  },
  autumn: {
    turfA: '#3A3A23', turfB: '#33341E', turfLine: 'rgba(255, 255, 255, 0.06)',
    soilFront: '#241A10', soilSide: '#1A120B', soilRim: 'rgba(255, 255, 255, 0.08)',
    groundShadow: 'rgba(0, 0, 0, 0.45)',
  },
  winter: {
    turfA: '#2E373A', turfB: '#293235', turfLine: 'rgba(255, 255, 255, 0.07)',
    soilFront: '#1F1A17', soilSide: '#171310', soilRim: 'rgba(255, 255, 255, 0.08)',
    groundShadow: 'rgba(0, 0, 0, 0.45)',
  },
};

/* ------------------------------------------------------- canvas definitions */

/**
 * Sprite parts that are structural rather than seasonal — bark, husks, stumps,
 * and the dunning ladder. They shift with the light, not with the month.
 */
const WOOD: Record<ResolvedMode, Pick<CanvasTokens,
  'trunkStarter' | 'trunkPro' | 'trunkScale' | 'trunkScaleRing' | 'trunkEnterprise' |
  'seedHusk' | 'seedStem' | 'stumpBody' | 'stumpTop' | 'health'>> = {
  light: {
    trunkStarter: '#5D4037',
    trunkPro: '#6D4C41',
    trunkScale: '#D1CBC1',
    trunkScaleRing: '#5D5852',
    trunkEnterprise: '#4A3428',
    seedHusk: '#6B5443',
    seedStem: '#9A8264',
    stumpBody: '#6B5443',
    stumpTop: '#8B735B',
    health: {
      yellowing: ['#F59E0B', '#FBBF24'],
      wilting: ['#D97706', '#F59E0B'],
      browning: ['#B45309', '#D97706'],
      recovered: ['#059669', '#F59E0B'],
    },
  },
  dark: {
    // Bark has to out-value the turf behind it or the trees lose their stems.
    trunkStarter: '#8A6853',
    trunkPro: '#94705A',
    trunkScale: '#B9B2A7',
    trunkScaleRing: '#6E675F',
    trunkEnterprise: '#7B5A45',
    seedHusk: '#8A7059',
    seedStem: '#B49B7C',
    stumpBody: '#8A7059',
    stumpTop: '#A98D71',
    health: {
      yellowing: ['#FBBF24', '#FCD34D'],
      wilting: ['#EF8A16', '#FBBF24'],
      browning: ['#C96A18', '#E8913C'],
      recovered: ['#34D399', '#FBBF24'],
    },
  },
};

const STARS: AmbientLayer = {
  kind: 'star',
  count: 70,
  colors: ['#FFFFFF', '#D8E6F5', '#F5EAD2'],
  size: [0.5, 1.5],
  speed: [0, 0],
  drift: 0,
  opacity: 0.55,
};

/**
 * A season is authored with one healthy green; the plan ramp is derived from
 * it, so seasons are still described in exactly one place.
 */
type SeasonCanvas = Omit<CanvasTokens, 'foliage'>;

const CANVAS: Record<Season, Record<ResolvedMode, SeasonCanvas>> = {
  /* -- SPRING: cool light, young yellow-green turf, blossom in the air ----- */
  spring: {
    light: {
      turfA: '#9AD46F', turfB: '#8BC963', turfLine: 'rgba(255, 255, 255, 0.26)',
      soilFront: '#6B4A34', soilSide: '#573B29', soilRim: '#432C1F',
      groundShadow: 'rgba(0, 0, 0, 0.08)',
      leaf: '#4CAE63', leafHighlight: '#78D08A', blossom: '#FFD9E7',
      ...WOOD.light,
      sproutLeaf: '#A6D573', sproutStem: '#4C9A57',
      stakePost: '#6D4C41',
      stakeTagFill: '#FFFFFF', stakeTagStroke: 'rgba(62, 158, 91, 0.32)', stakeTagText: '#1F6B39',
      tagFill: '#FFFFFF', tagStroke: 'rgba(62, 158, 91, 0.22)', tagShadow: 'rgba(0, 0, 0, 0.12)',
      tagTitle: '#111827', tagSub: '#6B7280', tagAccent: '#1F7A47', tagStem: '#3E9E5B',
      ringHover: '#F59E0B', ringMatch: '#3E9E5B', ringMatchFill: 'rgba(62, 158, 91, 0.18)',
      rain: 'rgba(140, 185, 200, 0.45)',
      sunbeamFill: 'rgba(245, 200, 90, 0.40)', sunbeamRing: '#F0B429',
      ambient: [{
        kind: 'petal', count: 34,
        colors: ['#FFD9E7', '#FFFFFF', '#FBCFE8'],
        size: [1.6, 3.4], speed: [0.35, 0.9], drift: 26, opacity: 0.85,
      }],
      litter: { colors: ['#FFFFFF', '#FBCFE8', '#FDE68A'], density: 0.16, size: 1.5 },
      canopySnow: null,
      sunWash: 'rgba(255, 244, 214, 0.16)',
      vignette: null,
    },
    dark: {
      ...DARK_GROUND.spring,
      leaf: '#4A8A61', leafHighlight: '#69A97F', blossom: '#EFA8C6',
      ...WOOD.dark,
      sproutLeaf: '#6FA95C', sproutStem: '#3E8A57',
      stakePost: '#8A6853',
      stakeTagFill: '#1C1F23', stakeTagStroke: 'rgba(87, 200, 122, 0.34)', stakeTagText: '#8FDCA6',
      tagFill: '#191C20', tagStroke: 'rgba(87, 200, 122, 0.26)', tagShadow: 'rgba(0, 0, 0, 0.6)',
      tagTitle: '#E9F0EB', tagSub: '#93A29A', tagAccent: '#7FD79A', tagStem: '#57C87A',
      ringHover: '#FBBF24', ringMatch: '#57C87A', ringMatchFill: 'rgba(87, 200, 122, 0.20)',
      rain: 'rgba(150, 200, 220, 0.32)',
      sunbeamFill: 'rgba(250, 214, 120, 0.28)', sunbeamRing: '#FBBF24',
      ambient: [
        {
          kind: 'petal', count: 26,
          colors: ['#EFA8C6', '#DCE8DE', '#E8B6CF'],
          size: [1.6, 3.2], speed: [0.3, 0.8], drift: 24, opacity: 0.55,
        },
        STARS,
      ],
      litter: { colors: ['rgba(255,255,255,0.28)', 'rgba(239,168,198,0.35)'], density: 0.12, size: 1.4 },
      canopySnow: null,
      sunWash: 'rgba(120, 160, 220, 0.10)',
      vignette: 'rgba(0, 0, 0, 0.40)',
    },
  },

  /* -- SUMMER: the original July afternoon, plus a night version ----------- */
  summer: {
    light: {
      turfA: '#84C252', turfB: '#78B845', turfLine: 'rgba(255, 255, 255, 0.22)',
      soilFront: '#5D4037', soilSide: '#4E342E', soilRim: '#422B24',
      groundShadow: 'rgba(0, 0, 0, 0.08)',
      // A leaf green rather than an emerald. `#10B981` is a UI accent — hue
      // 160, saturation 84% — and the whole plan ramp is derived from this one
      // pigment, so every canopy on the plot came out teal and slightly neon
      // against turf that is a true yellow-green. This is the foliage the plot
      // was tuned to: hue 136 at 44%, which is a leaf lit by the sun. The
      // ramp's lightness rungs are unchanged (the floor pins them at
      // 41/32/23/14 either way), so only the hue and the chroma move.
      leaf: '#327E46', leafHighlight: '#5CB977', blossom: '#FEF3C7',
      ...WOOD.light,
      sproutLeaf: '#8FBF5A', sproutStem: '#3E7A45',
      stakePost: '#6D4C41',
      stakeTagFill: '#FFFFFF', stakeTagStroke: 'rgba(16, 185, 129, 0.30)', stakeTagText: '#065F46',
      tagFill: '#FFFFFF', tagStroke: 'rgba(16, 185, 129, 0.20)', tagShadow: 'rgba(0, 0, 0, 0.12)',
      tagTitle: '#111827', tagSub: '#6B7280', tagAccent: '#059669', tagStem: '#059669',
      ringHover: '#F59E0B', ringMatch: '#10B981', ringMatchFill: 'rgba(16, 185, 129, 0.18)',
      rain: 'rgba(140, 185, 200, 0.45)',
      sunbeamFill: 'rgba(245, 158, 11, 0.45)', sunbeamRing: '#F59E0B',
      // Vetch purple. Summer's dunning ladder is amber, so the tail cannot be.
      ambient: [{
        // Pollen rises rather than falls — the one field that reads as heat.
        kind: 'mote', count: 26,
        colors: ['#FDE68A', '#FEF3C7', '#FFFFFF'],
        size: [0.9, 2.0], speed: [-0.5, -0.14], drift: 18, opacity: 0.6,
      }],
      litter: { colors: ['rgba(255,255,255,0.35)', 'rgba(20,90,45,0.16)'], density: 0.2, size: 1.3 },
      canopySnow: null,
      sunWash: 'rgba(255, 226, 150, 0.22)',
      vignette: null,
    },
    dark: {
      ...DARK_GROUND.summer,
      // The same hue as the day's leaf, at night's value: a season is one
      // green, and July foliage that goes from leaf-green to sea-green when the
      // lights drop is two seasons wearing one name. Saturation and lightness
      // are the ones that were tuned here — only the hue is re-aimed.
      leaf: '#3E8E56', leafHighlight: '#5DB176', blossom: '#FDE9B0',
      ...WOOD.dark,
      sproutLeaf: '#6FA95C', sproutStem: '#2FA36F',
      stakePost: '#8A6853',
      stakeTagFill: '#1C1F23', stakeTagStroke: 'rgba(52, 211, 153, 0.34)', stakeTagText: '#6EE7B7',
      tagFill: '#191C20', tagStroke: 'rgba(52, 211, 153, 0.26)', tagShadow: 'rgba(0, 0, 0, 0.6)',
      tagTitle: '#E9F0EB', tagSub: '#93A29A', tagAccent: '#5EEAD4', tagStem: '#34D399',
      ringHover: '#FBBF24', ringMatch: '#34D399', ringMatchFill: 'rgba(52, 211, 153, 0.20)',
      rain: 'rgba(150, 200, 220, 0.32)',
      sunbeamFill: 'rgba(250, 204, 100, 0.30)', sunbeamRing: '#FBBF24',
      ambient: [
        {
          // Fireflies: the summer night's answer to pollen.
          kind: 'firefly', count: 22,
          colors: ['#FDE68A', '#BBF7D0', '#FCD34D'],
          size: [1.2, 2.4], speed: [-0.16, 0.16], drift: 40, opacity: 0.9,
        },
        STARS,
      ],
      litter: { colors: ['rgba(255,255,255,0.16)', 'rgba(52,211,153,0.20)'], density: 0.14, size: 1.3 },
      canopySnow: null,
      sunWash: 'rgba(90, 140, 210, 0.10)',
      vignette: 'rgba(0, 0, 0, 0.42)',
    },
  },

  /* -- AUTUMN: ochre turf, rust canopies, leaves coming down --------------- */
  autumn: {
    light: {
      turfA: '#B2B85C', turfB: '#A3AA52', turfLine: 'rgba(255, 255, 255, 0.20)',
      soilFront: '#5A3D2A', soilSide: '#48301F', soilRim: '#382417',
      groundShadow: 'rgba(0, 0, 0, 0.09)',
      leaf: '#D97A2B', leafHighlight: '#F0A54A', blossom: '#FBE7BC',
      ...WOOD.light,
      // Amber *is* the season here, so the dunning ladder moves to crimson.
      // Left on its summer amber, a failing subscription would look exactly
      // like healthy October foliage.
      health: {
        yellowing: ['#E11D48', '#FB7185'],
        wilting: ['#BE123C', '#F43F5E'],
        browning: ['#881337', '#BE123C'],
        recovered: ['#0E9F6E', '#34D399'],
      },
      sproutLeaf: '#C2A94A', sproutStem: '#7A6A2E',
      stakePost: '#6D4C41',
      stakeTagFill: '#FFFDF8', stakeTagStroke: 'rgba(194, 102, 31, 0.32)', stakeTagText: '#8A4513',
      tagFill: '#FFFDF8', tagStroke: 'rgba(194, 102, 31, 0.22)', tagShadow: 'rgba(60, 30, 0, 0.14)',
      tagTitle: '#2A1B0E', tagSub: '#7A6857', tagAccent: '#9A4E17', tagStem: '#C2661F',
      ringHover: '#DC2626', ringMatch: '#C2661F', ringMatchFill: 'rgba(194, 102, 31, 0.18)',
      rain: 'rgba(150, 175, 190, 0.48)',
      sunbeamFill: 'rgba(240, 165, 74, 0.42)', sunbeamRing: '#E1701F',
      // Autumn moves the dunning ladder to crimson, which frees ochre for the
      // tail — and ochre is what an October meadow actually is.
      ambient: [{
        kind: 'leaf', count: 32,
        colors: ['#E1701F', '#C2410C', '#D9A441', '#B45309'],
        size: [2.0, 4.2], speed: [0.5, 1.3], drift: 34, opacity: 0.9,
      }],
      litter: { colors: ['#C2410C', '#D9A441', '#8A4513'], density: 0.3, size: 1.7 },
      canopySnow: null,
      sunWash: 'rgba(255, 196, 120, 0.20)',
      vignette: null,
    },
    dark: {
      ...DARK_GROUND.autumn,
      leaf: '#B4622A', leafHighlight: '#DA8A3D', blossom: '#E8C98A',
      ...WOOD.dark,
      // Amber *is* the season here, so the dunning ladder moves to crimson.
      // Left on its summer amber, a failing subscription would look exactly
      // like healthy October foliage.
      health: {
        yellowing: ['#FB7185', '#FDA4AF'],
        wilting: ['#F43F5E', '#FB7185'],
        browning: ['#BE123C', '#E11D48'],
        recovered: ['#34D399', '#6EE7B7'],
      },
      sproutLeaf: '#9A8A3E', sproutStem: '#6B5C28',
      stakePost: '#8A6853',
      stakeTagFill: '#1C1F23', stakeTagStroke: 'rgba(232, 145, 60, 0.34)', stakeTagText: '#F0AC63',
      tagFill: '#191C20', tagStroke: 'rgba(232, 145, 60, 0.26)', tagShadow: 'rgba(0, 0, 0, 0.6)',
      tagTitle: '#F2E9DD', tagSub: '#A39483', tagAccent: '#F0AC63', tagStem: '#E8913C',
      ringHover: '#FB7185', ringMatch: '#E8913C', ringMatchFill: 'rgba(232, 145, 60, 0.20)',
      rain: 'rgba(160, 180, 200, 0.30)',
      sunbeamFill: 'rgba(240, 172, 99, 0.28)', sunbeamRing: '#E8913C',
      ambient: [
        {
          kind: 'leaf', count: 26,
          colors: ['#A85520', '#8A3A0C', '#9A7530'],
          size: [2.0, 4.0], speed: [0.45, 1.15], drift: 32, opacity: 0.75,
        },
        STARS,
      ],
      litter: { colors: ['rgba(168,85,32,0.55)', 'rgba(154,117,48,0.5)'], density: 0.24, size: 1.6 },
      canopySnow: null,
      sunWash: 'rgba(150, 110, 190, 0.10)',
      vignette: 'rgba(0, 0, 0, 0.44)',
    },
  },

  /* -- WINTER: snow on the beds and on the canopies, evergreens beneath ---- */
  winter: {
    light: {
      turfA: '#E4ECEA', turfB: '#D6E1E0', turfLine: 'rgba(255, 255, 255, 0.55)',
      soilFront: '#4A3B33', soilSide: '#3A2E28', soilRim: '#2C221D',
      groundShadow: 'rgba(70, 90, 110, 0.10)',
      leaf: '#2F6B4E', leafHighlight: '#4E8A6A', blossom: '#FFFFFF',
      ...WOOD.light,
      sproutLeaf: '#7FA88C', sproutStem: '#3E6B52',
      stakePost: '#6D4C41',
      stakeTagFill: '#FFFFFF', stakeTagStroke: 'rgba(44, 125, 175, 0.32)', stakeTagText: '#215F87',
      tagFill: '#FFFFFF', tagStroke: 'rgba(44, 125, 175, 0.22)', tagShadow: 'rgba(20, 50, 80, 0.14)',
      tagTitle: '#0F1D26', tagSub: '#647882', tagAccent: '#215F87', tagStem: '#2C7DAF',
      ringHover: '#F59E0B', ringMatch: '#2C7DAF', ringMatchFill: 'rgba(44, 125, 175, 0.18)',
      // Sleet, not rain: paler and slower than the summer downpour.
      rain: 'rgba(205, 228, 244, 0.60)',
      sunbeamFill: 'rgba(255, 214, 130, 0.38)', sunbeamRing: '#F0B429',
      // Dormant seed heads above the snow.
      ambient: [{
        kind: 'snow', count: 48,
        colors: ['#FFFFFF', '#E8F1F8', '#F5FAFF'],
        size: [1.2, 2.8], speed: [0.3, 0.85], drift: 22, opacity: 0.9,
      }],
      litter: { colors: ['#FFFFFF', 'rgba(255,255,255,0.7)'], density: 0.14, size: 1.4 },
      canopySnow: '#F2F8FC',
      sunWash: 'rgba(200, 225, 255, 0.20)',
      vignette: null,
    },
    dark: {
      ...DARK_GROUND.winter,
      leaf: '#22574A', leafHighlight: '#3C8069', blossom: '#DCEAF5',
      ...WOOD.dark,
      sproutLeaf: '#6D9A8A', sproutStem: '#2E6152',
      stakePost: '#8A6853',
      stakeTagFill: '#141F27', stakeTagStroke: 'rgba(99, 182, 227, 0.34)', stakeTagText: '#93CDEE',
      tagFill: '#121C23', tagStroke: 'rgba(99, 182, 227, 0.26)', tagShadow: 'rgba(0, 0, 0, 0.6)',
      tagTitle: '#E6EFF5', tagSub: '#8FA0AB', tagAccent: '#93CDEE', tagStem: '#63B6E3',
      ringHover: '#FBBF24', ringMatch: '#63B6E3', ringMatchFill: 'rgba(99, 182, 227, 0.20)',
      rain: 'rgba(190, 220, 240, 0.36)',
      sunbeamFill: 'rgba(250, 214, 130, 0.26)', sunbeamRing: '#FBBF24',
      ambient: [
        {
          kind: 'snow', count: 44,
          colors: ['#DCE9F5', '#C6DCEE', '#FFFFFF'],
          size: [1.2, 2.6], speed: [0.28, 0.8], drift: 20, opacity: 0.7,
        },
        STARS,
      ],
      litter: { colors: ['rgba(220,233,245,0.35)', 'rgba(255,255,255,0.22)'], density: 0.12, size: 1.4 },
      canopySnow: '#BCD4E6',
      sunWash: 'rgba(120, 170, 225, 0.12)',
      vignette: 'rgba(0, 0, 0, 0.46)',
    },
  },
};

/* ------------------------------------------------------------ plan foliage */

/**
 * **The canopy deepens with the plan.**
 *
 * Plan was carried by silhouette alone — a low bush against a spreading crown
 * — which reads at a glance only while the two are side by side and the same
 * age. Filtered to one bed, or scanning a plot where a young account on the
 * dearest plan is smaller than an old one a rung below, there was nothing to
 * read but shape. So plan takes a second channel: colour, ordered, palest at
 * the cheapest plan through deepest at the dearest.
 *
 * Three rules make that safe to add on top of everything else the canopy
 * already says:
 *
 *  - **It is derived, not authored.** Each tier is the *season's own* leaf
 *    lifted or darkened, so October foliage is still October's and a new
 *    season is still one green to write. Eight palettes times a plan's worth of
 *    hand-picked hex is eight chances for spring to disagree with itself — and
 *    a table to re-pick every time the product adds a plan.
 *  - **It is a ramp, not a hue per plan.** Lightness carries it, in even steps,
 *    ordered by plan, with saturation and a few degrees of hue following in
 *    the same direction — young growth is pale, thin and yellow, mature
 *    foliage deep, rich and cool. An ordered encoding for an ordered field,
 *    and one that survives plot zoom: a hue nobody can name is still
 *    obviously darker than its neighbour.
 *  - **It never leaves the leaf's hue.** Dunning is a jump *off* green to
 *    amber or crimson and replaces the canopy outright; the plan ramp only
 *    ever moves within the healthy green. A plant in trouble therefore cannot
 *    be mistaken for a large plant, and the failure ladder stays the loudest
 *    thing on the plot.
 *
 * Colour means plan in every planting, including the ones bedded by retention
 * or by tenure, because a tree is always a subscription — only its bed
 * changes.
 */

interface FoliageShift {
  /** Saturation multiplier: mature foliage is the richer. */
  sat: number;
  /**
   * Degrees *toward yellow*, so young growth is yellow-green and mature
   * foliage cool — in a season whose leaf is already orange, toward yellow and
   * away from it mean exactly what they say. A signed rotation would run the
   * wrong way for half the palettes: +10° on autumn's orange is yellower, and
   * on summer's green it is bluer.
   */
  hue: number;
}

/**
 * The two ends of the ramp; every plan in between is read off the line.
 *
 * These were four hand-written pairs, one per plan, which is four numbers to
 * re-invent every time the ladder changes length. They were already a straight
 * line — the palest plan's 0.86/+7° to the deepest's 1.16/−7° — so the line
 * itself is what is authored now, and a four-plan ladder still lands on the
 * numbers that were tuned by eye.
 */
const FOLIAGE_PALEST: FoliageShift = { sat: 0.86, hue: 7 };
const FOLIAGE_DEEPEST: FoliageShift = { sat: 1.16, hue: -7 };

const foliageShift = (position: number): FoliageShift => ({
  sat: sampleRamp([FOLIAGE_PALEST.sat, FOLIAGE_DEEPEST.sat], position),
  hue: sampleRamp([FOLIAGE_PALEST.hue, FOLIAGE_DEEPEST.hue], position),
});

/** Where "toward yellow" points. */
const YELLOW = 60;

/**
 * Which way the ramp runs, and how far apart its rungs are.
 *
 * **In the day it sinks from the authored green; at night it lifts off it.**
 * The ground is what a canopy has to stay legible against, and the ground
 * changes sides between modes: light turf is the brightest thing on the plot,
 * so foliage that gets *paler* with the plan disappears into it, and the
 * authored leaf — which is already tuned to sit against that turf — belongs at
 * the pale end. Dark turf is the darkest thing, so it is the deep end that
 * would vanish, and the authored night green belongs there instead with the
 * rest of the ramp above it.
 *
 * Ramping the same direction in both modes is what the first cut did, and it
 * put a winter's dearest plan at 1.1:1 against its own bed.
 */
const RAMP_STEP: Record<ResolvedMode, number> = { light: 9, dark: 10 };

/**
 * The band the ramp has to fit inside.
 *
 * The floor keeps the deep end off black, where a canopy stops being a colour
 * and starts being a hole. The ceiling is the more interesting end: it holds
 * the palest plan *below* the dunning amber in value, so the loudest thing on
 * a night plot is still the plant that is failing rather than the smallest
 * plant that is fine.
 */
const FOLIAGE_FLOOR = 14;
const FOLIAGE_CEIL = 67;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];

  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) :
    max === g ? (b - r) / d + 2 :
    (r - g) / d + 4;

  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp(s, 0, 100) / 100;
  const lum = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] :
    [c, 0, x];

  const m = lum - c / 2;
  const byte = (v: number) => Math.round(clamp((v + m) * 255, 0, 255)).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * The four rungs, in lightness, for a season that starts from `leafL`.
 *
 * Even steps rather than a fraction of the room available: the reader is being
 * asked to tell four greens apart, and a ramp that crowds its bottom two rungs
 * together because the season happens to start dark has stopped encoding
 * anything down there. When the even ramp does not fit the band, the whole
 * thing *slides* into it — clamping the ends would land two plans on the same
 * colour, which is the one outcome worth avoiding.
 */
function rampLightness(leafL: number, mode: ResolvedMode, rungs: number): number[] {
  const step = RAMP_STEP[mode];
  const last = rungs - 1;
  const raw = Array.from({ length: rungs }, (_, i) =>
    mode === 'light' ? leafL - i * step : leafL + last * step - i * step);

  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  const slide = lo < FOLIAGE_FLOOR ? FOLIAGE_FLOOR - lo : hi > FOLIAGE_CEIL ? FOLIAGE_CEIL - hi : 0;
  return raw.map((l) => l + slide);
}

/** One pigment, moved onto a rung and turned the plan's few degrees. */
function shift(hex: string, by: FoliageShift, lightness: number): string {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h + Math.sign(YELLOW - h) * by.hue, s * by.sat, lightness);
}

function planFoliage(canvas: SeasonCanvas, mode: ResolvedMode): Record<PlanTier, [string, string]> {
  // Palest plan first: the ramp is walked up the ladder, whatever its length.
  const ladder = planNames();
  const [, , leafL] = hexToHsl(canvas.leaf);
  const [, , highlightL] = hexToHsl(canvas.leafHighlight);
  const base = rampLightness(leafL, mode, ladder.length);
  // The highlight walks its own ramp from its own starting lightness, so it
  // stays the same distance above the base it lights. A plan ramp on the base
  // with a fixed highlight reads as one sun per plan.
  const lit = rampLightness(highlightL, mode, ladder.length);

  const ramp: Record<PlanTier, [string, string]> = {};
  ladder.forEach((tier, i) => {
    const by = foliageShift(planPosition(tier));
    ramp[tier] = [shift(canvas.leaf, by, base[i]), shift(canvas.leafHighlight, by, lit[i])];
  });
  return ramp;
}

/* --------------------------------------------------------------- assembly */

const CACHE = new Map<string, Theme>();

export function getTheme(mode: ResolvedMode, season: Season): Theme {
  // The plan ramp is baked into the canvas tokens, so the ladder is part of
  // the cache key: installing a new catalogue must not serve last catalogue's
  // greens back for the rest of the session.
  const key = `${mode}:${season}:${planCatalogueVersion()}`;
  const hit = CACHE.get(key);
  if (hit) return hit;

  const canvas = CANVAS[season][mode];
  const theme: Theme = {
    mode,
    season,
    chrome: { ...CHROME_NEUTRAL[mode], ...CHROME_SEASON[season][mode] },
    // Derived once per (mode, season) and cached with the theme: the render
    // loop must never be doing colour arithmetic per plant per frame.
    canvas: { ...canvas, foliage: planFoliage(canvas, mode) },
  };
  CACHE.set(key, theme);
  return theme;
}

/**
 * Token name → CSS custom property. The provider writes these onto <html>;
 * `index.css` maps each one into Tailwind's colour namespace so components can
 * say `bg-surface` and never see a hex.
 */
/**
 * Token key → the CSS custom property it is written to on `<html>`.
 *
 * The accent family is published as `--garden-*` rather than `--accent-*`
 * because these share a document with shadcn, whose `--accent` is a muted
 * neutral. Two owners of one variable is not a clash you see — it is the whole
 * app's chrome quietly turning emerald. The TypeScript keys keep their own
 * names; only the wire format is namespaced.
 */
export const CHROME_VARS: Record<keyof ChromeTokens, string> = {
  pageFrom: '--page-from',
  pageVia: '--page-via',
  pageTo: '--page-to',
  surface: '--surface',
  surfaceSolid: '--surface-solid',
  inset: '--inset',
  insetStrong: '--inset-strong',
  hairline: '--hairline',
  ink: '--ink',
  inkSoft: '--ink-soft',
  inkFaint: '--ink-faint',
  inkInverse: '--ink-inverse',
  scrim: '--scrim',
  shadowPanel: '--shadow-panel',
  shadowModal: '--shadow-modal',
  shadowToast: '--shadow-toast',
  track: '--track',
  accent: '--garden',
  accentHover: '--garden-hover',
  accentInk: '--garden-ink',
  accentSoft: '--garden-soft',
  accentWash: '--garden-wash',
  accentLine: '--garden-line',
  warn: '--warn',
  warnInk: '--warn-ink',
  warnWash: '--warn-wash',
  warnLine: '--warn-line',
  danger: '--danger',
  dangerInk: '--danger-ink',
  dangerWash: '--danger-wash',
  dangerLine: '--danger-line',
  info: '--info',
  infoInk: '--info-ink',
  special: '--special',
  specialInk: '--special-ink',
};

/** Human labels for the appearance picker. */
export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

/**
 * The plan ramp at chip size.
 *
 * The chip is a key to the plot, so it takes the plot's hue — the same shifted
 * green a canopy of that plan is painted with. What it does *not* take is the
 * plot's lightness: a canopy is read against turf and a chip against a panel,
 * and the dearest plan's deep green on a dark panel is a hole rather than a dot. So
 * the ordering is re-struck across a band the chrome can actually show, and
 * the ramp stays a ramp in both modes.
 */
const SWATCH_BAND: Record<ResolvedMode, [number, number]> = {
  light: [58, 29],
  dark: [74, 45],
};

export function planSwatch(canvas: CanvasTokens, tier: PlanTier, mode: ResolvedMode): string {
  const foliage = canvas.foliage[tier];
  // A plan the current ladder does not sell — an old `?tier=` link, a
  // subscription arriving on a plan this build has not heard of — has no rung
  // and so has no colour. The chip falls back to the leaf rather than to
  // `undefined[0]`, which is a crash in a render loop.
  const [h, s] = hexToHsl(foliage ? foliage[0] : canvas.leaf);
  // Winter's greens are nearly grey, and a row of grey dots is not a key.
  return hslToHex(h, Math.max(s, 30), sampleRamp(SWATCH_BAND[mode], planPosition(tier)));
}

/** The two pigments that make a season recognisable at swatch size. */
export function seasonSwatch(season: Season, mode: ResolvedMode): [string, string] {
  const canvas = CANVAS[season][mode];
  return [canvas.turfA, canvas.leaf];
}
