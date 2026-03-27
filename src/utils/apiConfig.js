export const getApiBase = (cfg, envConfig) => {
  const url = (cfg?.siteUrl || envConfig?.siteUrl || "").replace(/\/$/, "");
  if (url.includes("naturesjoystore.com")) {
    return "/wc-api";
  }
  return url;
};
