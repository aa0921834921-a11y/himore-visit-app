import type { AnalysisResult, Customer, DictationAnswer, InputSource, Question, QuestionSet, Segment } from '../../types';

// AI 服務介面。POC 目前使用模擬版(mock.ts);之後接上正式服務時,只要另外實作這個介面並在 index.ts 切換。
// - transcribe:語音轉文字(錄音完成後批次轉寫,不做即時轉寫)
// - analyze:整理重點、比對題庫、找出偏好與避免事項、待辦建議;沒有原文依據的欄位填「未知」

export interface TranscribeInput {
  source: InputSource;
  audioUri?: string;
  audioDurationMs?: number;
  text?: string;
  dictation?: DictationAnswer[];
  questions: Question[];
  marks?: number[];
}

export interface AnalyzeInput {
  segments: Segment[];
  source: InputSource;
  questionSet?: QuestionSet;
  questions: Question[];
  customer?: Customer;
  customers: Customer[];
  salesId: string;
  glossary: string[];
  visitAt: string;
}

export interface AiService {
  readonly name: string;
  readonly isMock: boolean;
  transcribe(input: TranscribeInput): Promise<Segment[]>;
  analyze(input: AnalyzeInput): Promise<AnalysisResult>;
}
