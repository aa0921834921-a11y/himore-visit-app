// 網頁版部署到 GitHub Pages 時,網址會是 https://<帳號>.github.io/<專案名稱>/
// 由 GitHub Actions 傳入 EXPO_BASE_URL(例如 /himore-visit-app),本機開發時留空即可。
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    baseUrl: process.env.EXPO_BASE_URL || '',
  },
});
