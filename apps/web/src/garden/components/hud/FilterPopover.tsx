import React from 'react';
import { Search } from 'lucide-react';
import { type PlanTier } from '../../types';
import { planSwatch } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { Chip, Popover, SectionLabel } from './ui';

/**
 * Search, tier, health and growth filters — one popover instead of two
 * permanently open sidebar panels.
 *
 * All four filters are the same question ("show me fewer plants"), so they live
 * together and are summoned only when asked for. The active selection is
 * reported back on the status block, so nothing has to stay open to tell you a
 * filter is on.
 */

const HEALTH_OPTIONS = ['All', 'healthy', 'yellowing', 'wilting', 'browning', 'stump'];
const STAGE_OPTIONS = ['All', 'seed', 'sprout', 'young', 'established', 'mature', 'ancient'];

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

interface FilterPopoverProps {
  open: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedTier: PlanTier | 'All' | null;
  onSelectTier: (tier: PlanTier | 'All') => void;
  tierCounts: Record<PlanTier, number>;
  selectedHealth: string;
  onHealthSelect: (value: string) => void;
  selectedStage: string;
  onStageSelect: (value: string) => void;
  matchingCount: number;
  totalCount: number;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  selectedTier,
  onSelectTier,
  tierCounts,
  selectedHealth,
  onHealthSelect,
  selectedStage,
  onStageSelect,
  matchingCount,
  totalCount,
}) => {
  const { resolvedMode, theme } = useTheme();
  // The dot is the plan's own foliage, so the chip is a key to the plot rather
  // than a second, unrelated colour ladder for the same field. It follows the
  // season for the same reason: a key that stays summer green while the plot
  // has turned is a key that is wrong.
  const tierDot = (tier: PlanTier) => planSwatch(theme.canvas, tier, resolvedMode);

  return (
  <Popover open={open} onClose={onClose} className="right-0 top-12 w-[320px] p-4">
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        autoFocus
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search customer, plan or country"
        className="w-full rounded-2xl border border-hairline bg-inset py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-garden-line focus:bg-surface-solid"
      />
    </div>

    <div className="mt-4">
      <SectionLabel>Plan</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip label="All" selected={selectedTier === 'All'} onClick={() => onSelectTier('All')} />
        {(Object.keys(tierCounts) as PlanTier[]).map((tier) => (
          <Chip
            key={tier}
            label={tier}
            count={tierCounts[tier]}
            dot={tierDot(tier)}
            selected={selectedTier === tier}
            onClick={() => onSelectTier(tier)}
          />
        ))}
      </div>
    </div>

    <div className="mt-4">
      <SectionLabel>Health</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {HEALTH_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={titleCase(option)}
            selected={selectedHealth === option}
            onClick={() => onHealthSelect(option)}
          />
        ))}
      </div>
    </div>

    <div className="mt-4">
      <SectionLabel>Growth stage</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {STAGE_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={titleCase(option)}
            selected={selectedStage === option}
            onClick={() => onStageSelect(option)}
          />
        ))}
      </div>
    </div>

    <div className="mt-4 border-t border-hairline pt-3 text-[12px] font-semibold text-ink-faint">
      Showing <span className="text-ink">{matchingCount}</span> of {totalCount} plants
    </div>
  </Popover>
  );
};
