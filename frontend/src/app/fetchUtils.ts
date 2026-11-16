export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function fetchWithLogging(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (e) {
        bodyText = "Could not read response body";
      }
      console.error(`Fetch failed: ${url} | Status: ${response.status} | Body: ${bodyText}`);
      let parsedError = bodyText;
      try {
        const json = JSON.parse(bodyText);
        if (json.detail) parsedError = json.detail;
      } catch (e) {}
      throw new Error(`HTTP ${response.status}: ${parsedError}`);
    }
    return response;
  } catch (err: any) {
    console.error(`Fetch exception for ${url}:`, err);
    throw err;
  }
}
