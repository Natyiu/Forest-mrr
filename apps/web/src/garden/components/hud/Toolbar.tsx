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
  /**
   * Which cluster this tool belongs to.
   *
   * Tools that do the same *kind* of thing sit together, with a hairline between
   * groups: **finding** things (search, filter) is a different act from **changing
   * how the plot looks**, and reading them as one undivided row of five makes a
   * person check every icon to find the one they meant. A group is only drawn
   * when it has something in it, so switching a feature off never leaves a
   * divider with nothing on one side of it.
   */
  group?: string;
};

/** Tools in declaration order, gathered into the clusters they named. */
function groupsOf(tools: Tool[]): Array<{ name: string; tools: Tool[] }> {
  const groups: Array<{ name: string; tools: Tool[] }> = [];

  for (const tool of tools) {
    const name = tool.group ?? tool.id;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.tools.push(tool);
    else groups.push({ name, tools: [tool] });
  }

  return groups;
}

export const Toolbar: React.FC<{
  tools: Tool[];
  primary?: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void };
  /**
   * Whoever is signed in, and their way out.
   *
   * A slot rather than more `Tool` rows: an avatar with a menu hanging off it
   * is not an icon button, and this is the host app's business — the garden
   * knows there is something to put here and nothing about what it is.
   */
  account?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ tools, primary, account, children }) => (
  <div className="pointer-events-auto relative">
    <Surface className="flex items-center gap-0.5 p-1.5">
      {groupsOf(tools).map((group, index) => (
        <React.Fragment key={group.name}>
          {index > 0 ? <Divider /> : null}
          {group.tools.map((tool) => (
            <IconButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              onClick={tool.onClick}
              tone={tool.tone}
              badge={tool.badge}
            />
          ))}
        </React.Fragment>
      ))}

      {primary ? (
        <>
          <Divider />
          <TextButton icon={primary.icon} onClick={primary.onClick} tone="primary">
            {primary.label}
          </TextButton>
        </>
      ) : null}

      {account ? (
        <>
          <Divider />
          {account}
        </>
      ) : null}
    </Surface>

    {/* Popovers anchor to this pill. */}
    {children}
  </div>
);
