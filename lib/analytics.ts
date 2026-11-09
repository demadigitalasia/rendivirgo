const GA_ID_PATTERN = /^G-[A-Z0-9]{4,}$/i;

export const gaMeasurementId = (): string => {
  const id = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
  return GA_ID_PATTERN.test(id) ? id : "";
};
