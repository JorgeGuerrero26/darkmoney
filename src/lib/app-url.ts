function normalizeAppUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getPublicAppUrl() {
  const configuredAppUrl =
    normalizeAppUrl(import.meta.env.VITE_PUBLIC_APP_URL) ??
    normalizeAppUrl(import.meta.env.VITE_APP_URL);

  if (configuredAppUrl) {
    return configuredAppUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "https://darkmoney.company";
}

