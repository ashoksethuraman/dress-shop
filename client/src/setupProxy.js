const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // 🔥 ONLY in dev emulator mode
  if (process.env.REACT_APP_USE_EMULATOR !== "true") return;

  const projectId =
    process.env.REACT_APP_FIREBASE_PROJECT_ID || "halleycomet-7cd48";

  app.use(
    "/api",
    createProxyMiddleware({
      target: `http://127.0.0.1:5001/${projectId}/asia-south1/api`,
      changeOrigin: true,

      // remove /api prefix
      pathRewrite: {
        "^/api": "",
      },

      cookieDomainRewrite: "localhost",
      logLevel: "silent",
    })
  );
};