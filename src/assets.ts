// 素材對照:編號來自「素材逐個生成提示詞清單」。Metro 只接受字面路徑,所以逐一列出。
export const ICON = {
  mic: require('../assets/ui/icons/b001.png'), // B-001 麥克風
  dictate: require('../assets/ui/icons/b002.png'), // B-002 口述
  text: require('../assets/ui/icons/b003.png'), // B-003 文字輸入
  upload: require('../assets/ui/icons/b004.png'), // B-004 雲端上傳
  uploaded: require('../assets/ui/icons/b005.png'), // B-005 上傳完成
  ai: require('../assets/ui/icons/b006.png'), // B-006 AI
  bank: require('../assets/ui/icons/b007.png'), // B-007 題庫
  customer: require('../assets/ui/icons/b008.png'), // B-008 客戶
  folder: require('../assets/ui/icons/b009.png'), // B-009 客戶檔案
  warn: require('../assets/ui/icons/b010.png'), // B-010 警示
  check: require('../assets/ui/icons/b011.png'), // B-011 勾選
  lock: require('../assets/ui/icons/b012.png'), // B-012 鎖
  calendar: require('../assets/ui/icons/b013.png'), // B-013 日曆
  bell: require('../assets/ui/icons/b014.png'), // B-014 通知
  gear: require('../assets/ui/icons/b015.png'), // B-015 設定
  sync: require('../assets/ui/icons/b016.png'), // B-016 同步
  offline: require('../assets/ui/icons/b017.png'), // B-017 離線
  download: require('../assets/ui/icons/b018.png'), // B-018 下載
  csv: require('../assets/ui/icons/b019.png'), // B-019 CSV
  search: require('../assets/ui/icons/b020.png'), // B-020 搜尋
  filter: require('../assets/ui/icons/b021.png'), // B-021 篩選
  edit: require('../assets/ui/icons/b022.png'), // B-022 編輯
  star: require('../assets/ui/icons/b023.png'), // B-023 星號
  dot: require('../assets/ui/icons/b024.png'), // B-024 紅點
  flag: require('../assets/ui/icons/b025.png'), // B-025 標記重點
  photo: require('../assets/ui/icons/b026.png'), // B-026 照片
  attach: require('../assets/ui/icons/b027.png'), // B-027 附件
  paste: require('../assets/ui/icons/b028.png'), // B-028 貼上
  trash: require('../assets/ui/icons/b029.png'), // B-029 清除
  back: require('../assets/ui/icons/b030.png'), // B-030 返回
  more: require('../assets/ui/icons/b031.png'), // B-031 更多
  play: require('../assets/ui/icons/b032.png'), // B-032 播放
  pause: require('../assets/ui/icons/b033.png'), // B-033 暫停
  stop: require('../assets/ui/icons/b034.png'), // B-034 停止
  plus: require('../assets/ui/icons/b035.png'), // B-035 新增
  user: require('../assets/ui/icons/b036.png'), // B-036 使用者
  users: require('../assets/ui/icons/b037.png'), // B-037 多人
  spinner: require('../assets/ui/icons/b038.png'), // B-038 處理中
  down: require('../assets/ui/icons/b039.png'), // B-039 向下展開
  right: require('../assets/ui/icons/b040.png'), // B-040 向右前往
  robot: require('../assets/ui/icons/b041.png'), // B-041 產品系列
  machine: require('../assets/ui/icons/b042.png'), // B-042 機台導入
  home: require('../assets/ui/icons/b043.png'), // B-043 首頁
} as const;

export type IconName = keyof typeof ICON;

export const NAV = {
  homeOff: require('../assets/ui/nav/a06_1.png'), // A-06-1
  customersOff: require('../assets/ui/nav/a06_2.png'), // A-06-2
  recordOff: require('../assets/ui/nav/a06_3.png'), // A-06-3
  meOff: require('../assets/ui/nav/a06_4.png'), // A-06-4
  homeOn: require('../assets/ui/nav/a07_1.png'), // A-07-1
  customersOn: require('../assets/ui/nav/a07_2.png'), // A-07-2
  recordOn: require('../assets/ui/nav/a07_3.png'), // A-07-3
  meOn: require('../assets/ui/nav/a07_4.png'), // A-07-4
  recordButton: require('../assets/ui/nav/a08.png'), // A-08 中央記錄按鈕
  recordButtonPressed: require('../assets/ui/nav/a09.png'), // A-09 按下
};

export const REC = {
  idle: require('../assets/ui/rec/e001.png'), // E-001 錄音主按鈕 待機
  recording: require('../assets/ui/rec/e002.png'), // E-002 錄音中
  locked: require('../assets/ui/rec/e003.png'), // E-003 鎖定
  waveActive: require('../assets/ui/rec/e004.png'), // E-004 聲波(錄音中)
  waveIdle: require('../assets/ui/rec/e005.png'), // E-005 聲波(待機)
  timerFrame: require('../assets/ui/rec/e006.png'), // E-006 計時器底框
};

export const CTL = {
  checkboxOff: require('../assets/ui/ctl/c011.png'), // C-011
  checkboxOn: require('../assets/ui/ctl/c012.png'), // C-012
  radioOff: require('../assets/ui/ctl/c013.png'), // C-013
  radioOn: require('../assets/ui/ctl/c014.png'), // C-014
  toggleOff: require('../assets/ui/ctl/c015.png'), // C-015
  toggleOn: require('../assets/ui/ctl/c016.png'), // C-016
};

export const STATE = {
  done: require('../assets/ui/state/c026.png'), // C-026 完成圓點
  active: require('../assets/ui/state/c027.png'), // C-027 進行中圓點
  waiting: require('../assets/ui/state/c028.png'), // C-028 等待圓環
  badge: require('../assets/ui/state/d011.png'), // D-011 完成徽章
  empty: require('../assets/ui/state/f008.png'), // F-008 空狀態插圖
};

export const BG = {
  base: require('../assets/ui/bg/g001.jpg'), // G-001
  login: require('../assets/ui/bg/g002.jpg'), // G-002
  home: require('../assets/ui/bg/g003.jpg'), // G-003
  record: require('../assets/ui/bg/g004.jpg'), // G-004
  process: require('../assets/ui/bg/g005.jpg'), // G-005
  admin: require('../assets/ui/bg/g006.jpg'), // G-006
};

export const BRAND = {
  // 暫用:GPT 依官網截圖重製的標誌。正式上線前請換成哈鏌官方檔案(同檔名覆蓋即可)。
  logo: require('../assets/ui/brand/logo_white.png'),
  logoRatio: 2400 / 422,
};
