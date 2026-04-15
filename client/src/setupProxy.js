/**
 * CRA dev-server proxy — emulator mode only.
 *
 * When REACT_APP_USE_EMULATOR=true the client sets API_BASE_URL to '/api'.
 * This file routes those same-origin requests through the webpack-dev-server
 * to the local Functions emulator, eliminating CORS entirely in development
 * (the browser never sees a cross-origin request, so no preflight is sent).
 *
 * In production the built bundle is served from Firebase Hosting and talks
 * directly to the Functions URL — this file is never used.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  if (process.env.REACT_APP_USE_EMULATOR !== 'true') return;

  const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'halleycomet-7cd48';

  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://127.0.0.1:5001/${projectId}/asia-south1/api`,
      changeOrigin: true,
      // Strip the /api prefix before forwarding so the emulator receives
      // /{projectId}/{region}/api/{path} and Express sees just /{path}
      pathRewrite: { '^/api': '' },
      // Forward cookies both ways so the session / CSRF flow works
      cookieDomainRewrite: 'localhost',
      logLevel: 'debug',
    }),
  );
};
