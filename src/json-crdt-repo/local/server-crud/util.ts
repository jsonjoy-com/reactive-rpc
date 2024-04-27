export const genId = (octets: number = 8): string => {
  const uint8 = crypto.getRandomValues(new Uint8Array(octets));
  let hex = '';
  for (let i = 0; i < octets; i++) hex += uint8[i].toString(16).padStart(2, '0');
  return hex;
};
