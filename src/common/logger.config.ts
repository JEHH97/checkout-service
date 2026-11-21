export const logRedaction = {
  paths: [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'clientSecret',
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers.set-cookie',
    'req.body.password',
    'req.body.token',
    'req.body.accessToken',
    'req.body.refreshToken',
    'req.body.clientSecret',
    '*.password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.clientSecret',
  ],
  censor: '[REDACTED]',
};

export const pinoHttpOptions = {
  redact: logRedaction,
};
