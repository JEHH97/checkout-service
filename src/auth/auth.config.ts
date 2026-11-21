export function jwtExpiresIn(env: NodeJS.ProcessEnv = process.env): string {
  return env.JWT_EXPIRES_IN?.trim() || '1h';
}
