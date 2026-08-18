import React from 'react';
import { Divider, IconButton, Surface, TextButton } from './ui';

/**
 * Every tool, in one pill, top-right.
 *
 * Adding a tool used to mean pasting a dozen Tailwind classes into App.tsx and
 * hoping it matched its neighbours. A tool is now a row in an array: give it an
 * icon, a name and a handler. The primary action is the only one that keeps its
 * label, because it is the only one worth the width.
 */

export type Tool = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: 'plain' | 'active';
  badge?: number;
};

export const Toolbar: React.FC<{
  tools: Tool[];
  primary?: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void };
  children?: React.ReactNode;
}> = ({ tools, primary, children }) => (
  <div className="pointer-events-auto relative">
    <Surface className="flex items-center gap-0.5 p-1.5">
      {tools.map((tool) => (
        <IconButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          onClick={tool.onClick}
          tone={tool.tone}
          badge={tool.badge}
        />
      ))}

      {primary ? (
        <>
          <Divider />
          <TextButton icon={primary.icon} onClick={primary.onClick} tone="primary">
            {primary.label}
          </TextButton>
        </>
      ) : null}
    </Surface>

    {/* Popovers anchor to this pill. */}
    {children}
  </div>
);
