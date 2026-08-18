import { type PlanTier, type Plant } from '../types';
import { type BedTone, type ViewBed } from './gardenViews';
import { stringHash } from './prng';

/**
 * Where every subscription stands.
 *
 * This is deliberately *not* the same question as `PlantShape`. A shape is how
 * a subscription is drawn — a tree, a tower, a fish. This is where it is
 * planted, and the two are independent: the beds hold the same book at the
 * same sizes whichever way it is drawn.
 *
 * It returns three things — a placement per plant, a stake per bed, and the
 * geometry of the ground under them — and everything downstream (the depth
 * sort, the hit test, the camera flight, the activity toasts) reads those three
 * and nothing else.
 *
 * There was once a second layout here, `rings`, which walked the same beds
 * round a middle. It is gone, along with its query string (`?plot=rings`), its
 * `L` binding and its switch in the control bar — an old link carrying it lands
 * on the beds, which are now the only thing there is to land on.
 */

export interface PlantPlacement {
  plant: Plant;
  gx: number;
  gy: number;
  tier: PlanTier;
  /** `gone` plants are drawn as stumps whatever their health says. */
  tone: BedTone;
}

export interface BedMarker {
  label: string;
  note: string;
  gx: number;
  gy: number;
  plantCount: number;
  tone: BedTone;
}

export interface PlotGeometry {
  cols: number;
  rows: number;
}

export interface PlotPlacement {
  placements: PlantPlacement[];
  bedMarkers: BedMarker[];
  geometry: PlotGeometry;
}

/**
 * Deterministic order within a bed: cohort month, then a hash of the id.
 *
 * A plant has to keep its place between frames and between months — a month's
 * worth of new signups should arrive in the garden, not deal the whole customer
 * base out again.
 */
const inBedOrder = (plants: Plant[]) =>
  [...plants].sort((a, b) => {
    if (a.cohort !== b.cohort) return a.cohort.localeCompare(b.cohort);
    return stringHash(a.subscription_id) - stringHash(b.subscription_id);
  });

/**
 * Lay the beds out down the plot, ten plants to a row.
 *
 * The beds are whatever the current planting says they are — plans for MRR,
 * what became of last month's customers for net retention, and so on. The
 * geometry does not care which: a bed is a labelled run of rows, and the
 * planting decides who stands in it.
 */
export function computeBedPlacement(beds: ViewBed[]): PlotPlacement {
  const GRID_COLS = 10; // 10 columns per row
  const placements: PlantPlacement[] = [];
  const bedMarkers: BedMarker[] = [];

  let currentGY = 0;

  beds.forEach((viewBed) => {
    const members = inBedOrder(viewBed.plants);
    const startGY = currentGY;

    bedMarkers.push({
      label: viewBed.label,
      note: viewBed.note,
      gx: -0.5,
      gy: startGY + 0.5,
      plantCount: members.length,
      tone: viewBed.tone,
    });

    if (members.length === 0) {
      // An empty bed still gets its row and its stake: "nobody churned" is a
      // reading, and a bed silently missing from the plot is not.
      currentGY += 1;
    } else {
      members.forEach((plant, idx) => {
        placements.push({
          plant,
          gx: idx % GRID_COLS,
          gy: startGY + Math.floor(idx / GRID_COLS),
          tier: plant.plan,
          tone: viewBed.tone,
        });
      });

      currentGY += Math.ceil(members.length / GRID_COLS);
    }
  });

  return {
    placements,
    bedMarkers,
    geometry: { cols: GRID_COLS, rows: Math.max(10, currentGY) },
  };
}
