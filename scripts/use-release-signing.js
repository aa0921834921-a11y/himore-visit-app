// GitHub Actions 打包時使用:把 release 版本改用正式簽章(資料來自 android/gradle.properties 的 HIMORE_* 設定)
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let s = fs.readFileSync(file, 'utf8');
if (!s.includes('HIMORE_STORE_FILE')) {
  s = s.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {
        release {
            storeFile file(HIMORE_STORE_FILE)
            storePassword HIMORE_STORE_PASSWORD
            keyAlias HIMORE_KEY_ALIAS
            keyPassword HIMORE_KEY_PASSWORD
        }`,
  );
  const i = s.indexOf('buildTypes');
  const head = s.slice(0, i);
  const tail = s.slice(i).replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
  s = head + tail;
  fs.writeFileSync(file, s);
}
console.log('已改用正式簽章');
