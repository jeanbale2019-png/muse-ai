// ------------------------------------------------------------------
// Backward-compat exports (keep old components compiling)
// Frontend no longer calls Gemini SDK directly.
// ------------------------------------------------------------------

export const ensureApiKey = async () => true;

/** No-op: kept only because VisualLab imports it */
export const handleGeminiError = async (_err: any) => false;

/** Optional: if VisualLab imports these, provide server-backed versions */
export const generateVeoVideo = async (
  prompt: string,
  imageBase64?: string,
  mimeType?: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
  resolution: "720p" | "1080p" = "720p"
) => {
  return await postJSON<{ url: string; videoObject?: any }>("/api/veo-video", {
    prompt,
    imageBase64,
    mimeType,
    aspectRatio,
    resolution,
  });
};

export const extendVeoVideo = async (prompt: string, previousVideo: any) => {
  return await postJSON<{ url: string; videoObject?: any }>("/api/veo-extend", {
    prompt,
    previousVideo,
  });
};
