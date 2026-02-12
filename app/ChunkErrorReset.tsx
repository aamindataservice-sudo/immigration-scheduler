"use client";

import { useEffect } from "react";

const CHUNK_ERROR_RELOAD_KEY = "chunkErrorReload";

/** Clear chunk-error reload flag on successful load so future chunk errors get one auto-retry. */
export default function ChunkErrorReset() {
  useEffect(() => {
    sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
  }, []);
  return null;
}
