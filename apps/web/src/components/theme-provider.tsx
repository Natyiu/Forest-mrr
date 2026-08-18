"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & {
  // next-themes' own props type stopped declaring `children` once React 19's
  // types dropped the implicit one, so it has to be declared here.
  children?: React.ReactNode;
}) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
