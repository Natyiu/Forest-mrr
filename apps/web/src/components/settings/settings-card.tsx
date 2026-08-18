import { cn } from "@/lib/utils";

/**
 * **A settings section, as a card.**
 *
 * Every one of these screens was a stack of hairline-ruled sections floating
 * directly on the page. That is the one layout this app's visual language cannot
 * do: separation here comes from *fill and elevation* — white cards lifted off a
 * tinted page — so a section with no fill is a heading and some inputs adrift on
 * mint, and an input whose background is `transparent` is a rectangle drawn on the
 * page rather than a field you can type in.
 *
 * The other half of what was wrong was scale. Labels at 9–11px in
 * `muted-foreground/40` are decoration, not text: the instruction telling you the
 * maximum avatar size was fainter than the placeholder in the box below it.
 * Everything here is at the same weight as the startups screen, and the tokens are
 * used undiluted — if a line is worth putting on the page it is worth being able
 * to read.
 *
 * `footer` is where the action for the section goes. A Save button belongs *inside*
 * the thing it saves, on its own band, rather than floating under it where it could
 * as easily belong to whatever comes next.
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  tone = "default",
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** `danger` for a section whose action cannot be undone. */
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] border bg-card shadow-elev-1",
        tone === "danger" ? "border-destructive/30" : "border-border",
        className,
      )}
    >
      <header className="px-5 pt-5">
        <h2
          className={cn(
            "text-[15px] font-semibold",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>
        )}
      </header>

      <div className="px-5 py-5">{children}</div>

      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}

/** A labelled control. One shape for every field on every settings screen. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The class every input and textarea on these screens wears.
 *
 * A soft inset fill rather than the primitive's `bg-transparent`: on a white card
 * that is invisible, and on this app's tinted page it made the field the same
 * colour as the background behind the card.
 */
export const FIELD_INPUT =
  "h-11 rounded-xl border-border bg-muted/60 px-3.5 text-[13px] md:text-[13px]";
