export const productionIsopediaUrl = "https://isopedia.crestedcritters.com";
export const stagingIsopediaUrl = "https://test.crestedcritters.com";

export function getIsopediaBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (isStagingDeployment() ? stagingIsopediaUrl : productionIsopediaUrl)
  ).replace(/\/$/, "");
}

export function isStagingDeployment() {
  return (
    process.env.NEXT_PUBLIC_ISOPEDIA_ENV === "staging" ||
    process.env.ISOPEDIA_ENV === "staging" ||
    process.env.ISOPEDIA_STAGING_LOCK === "true"
  );
}

export function isStagingHost(host: string) {
  const normalizedHost = host.toLowerCase().split(":")[0];
  const configuredHosts = (
    process.env.ISOPEDIA_STAGING_HOSTS || "test.crestedcritters.com"
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return configuredHosts.includes(normalizedHost);
}

export function absoluteIsopediaUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getIsopediaBaseUrl()}${normalizedPath}`;
}
