import { redisConnectionFromUrl } from '../../src/common/redis-connection';

describe('redisConnectionFromUrl', () => {
  it('selects the database index from the URL path', () => {
    const options = redisConnectionFromUrl('redis://red-example:6379/1');
    expect(options).toMatchObject({ host: 'red-example', port: 6379, db: 1 });
  });

  it('uses database 0 when the URL has no path', () => {
    expect(redisConnectionFromUrl('redis://red-example:6379').db).toBe(0);
    expect(redisConnectionFromUrl('redis://red-example:6379/').db).toBe(0);
  });

  it('decodes credentials and enables TLS for rediss URLs', () => {
    const options = redisConnectionFromUrl('rediss://user:p%40ss@cache.example:6380/2');
    expect(options).toMatchObject({
      username: 'user',
      password: 'p@ss',
      port: 6380,
      db: 2,
      tls: {},
    });
  });

  it('rejects a non-numeric database path', () => {
    expect(() => redisConnectionFromUrl('redis://red-example:6379/abc')).toThrow(
      'numeric database index',
    );
  });
});
