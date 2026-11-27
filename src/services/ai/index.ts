import { mockAi } from './mock';
import { createRemoteAi, serverConfig } from './remote';
import type { AiService } from './types';

// 有設定 AI 伺服器(系統設定/我的 → AI 伺服器)就用本機 AI 伺服器,沒有就用模擬 AI。
// 之後接其他正式服務:新增一個實作 AiService 的檔案,在 current() 切換即可。
const remoteAi = createRemoteAi();
const current = (): AiService => (serverConfig() ? remoteAi : mockAi);

export const ai: AiService = {
  get name() {
    return current().name;
  },
  get isMock() {
    return current().isMock;
  },
  transcribe: (input) => current().transcribe(input),
  analyze: (input) => current().analyze(input),
};

export type { AiService } from './types';
export { DEMO_TEXT } from './mock';
