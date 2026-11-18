import { mockAi } from './mock';
import type { AiService } from './types';

// 目前使用模擬 AI。接正式服務時:新增一個實作 AiService 的檔案(例如 claude.ts),在這裡切換即可。
export const ai: AiService = mockAi;

export type { AiService } from './types';
export { DEMO_TEXT } from './mock';
