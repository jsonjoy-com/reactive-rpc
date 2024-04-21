const REGEX_AUTH_TOKEN_SPECIFIER = /tkn\.([a-zA-Z0-9\-_]+)(?:[^a-zA-Z0-9\-_]|$)/;

export const findTokenInText = (text: string): string => {
  const match = REGEX_AUTH_TOKEN_SPECIFIER.exec(text);
  if (!match) return '';
  return match[1] || '';
};
