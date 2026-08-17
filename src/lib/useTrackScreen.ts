import { useEffect } from "react";
import { track } from "./analytics";

let lastScreen: string | null = null;

/** Fires 'View Screen' once per screen mount, matching the legacy PWA's manual pageview tracking. */
export function useTrackScreen(screen: string): void {
  useEffect(() => {
    track("View Screen", { screen, previous_screen: lastScreen });
    lastScreen = screen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
}
