import { useEffect, useRef } from "react";

/**
 * Minimal keyboard hook. Reads callbacks from a ref to avoid
 * any circular dependency / TDZ issues in production builds.
 */
export default function useKeyboard() {
  const handlerRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      handlerRef.current?.(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return handlerRef;
}
