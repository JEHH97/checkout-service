import { JwtService } from '@nestjs/jwt';
import { jwtExpiresIn } from '../../src/auth/auth.config';
import { JwtSignOptions } from '@nestjs/jwt';
import { rateLimitConfig } from '../../src/common/rate-limit.config';

describe('authentication security configuration', () => {
  it('uses a one-hour JWT lifetime by default and supports configuration', () => {
    expect(jwtExpiresIn({})).toBe('1h');
    expect(jwtExpiresIn({ JWT_EXPIRES_IN: '20m' })).toBe('20m');
  });

  it('signs expiring tokens that are rejected after their lifetime', async () => {
    const now = Date.now();
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const jwt = new JwtService({
        secret: 'unit-test-secret',
        signOptions: {
          expiresIn: jwtExpiresIn({ JWT_EXPIRES_IN: '1s' }) as JwtSignOptions['expiresIn'],
        },
      });
      const token = await jwt.signAsync({ sub: 'user-1' });
      const payload = await jwt.verifyAsync<{ iat: number; exp: number }>(token);
      expect(payload.exp - payload.iat).toBe(1);

      dateNow.mockReturnValue(now + 2_000);
      await expect(jwt.verifyAsync(token)).rejects.toThrow();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('configures moderate production limits and a higher test budget', () => {
    expect(rateLimitConfig({ NODE_ENV: 'production' })).toEqual({
      ttl: 60_000,
      globalLimit: 120,
      authLimit: 8,
    });
    expect(rateLimitConfig({ NODE_ENV: 'test' })).toEqual({
      ttl: 60_000,
      globalLimit: 10_000,
      authLimit: 1_000,
    });
    expect(
      rateLimitConfig({ THROTTLE_TTL_MS: '30000', THROTTLE_LIMIT: '60', AUTH_THROTTLE_LIMIT: '5' }),
    ).toEqual({ ttl: 30_000, globalLimit: 60, authLimit: 5 });
  });
});
