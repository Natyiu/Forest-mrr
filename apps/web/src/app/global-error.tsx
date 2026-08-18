"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="bg-black text-white">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-6 px-6">
            <div className="space-y-2">
              <h1 className="text-7xl font-bold tracking-tighter text-destructive/30">
                Error
              </h1>
              <h2 className="text-xl font-semibold tracking-tight">
                Critical Error
              </h2>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                The application encountered a critical error.
              </p>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md bg-white text-black px-4 py-2 text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
