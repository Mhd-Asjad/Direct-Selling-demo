/**
 * A custom fetch helper that automatically prepends the backend API URL (VITE_API_URL)
 * and attaches credentials/session cookies to the request.
 */
export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const url = typeof input === "string" ? input : input.toString();
  
  // Only prepend VITE_API_URL to relative paths starting with /
  const fullUrl = url.startsWith("/") && !url.startsWith("//") ? `${baseUrl}${url}` : url;
  
  return fetch(fullUrl, {
    credentials: "include",
    ...init,
  });
}
