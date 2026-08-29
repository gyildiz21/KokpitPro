// GEÇİCİ: entegrasyonda AJAN A modülleriyle değiştirilir.
//
// Bu dosya yalnız AJAN B dalının typecheck+test döngüsünü ayakta tutar;
// deterministik öneri mantığı İÇERMEZ ve üretimde asla koşmaz: testler
// analizörü enjekte eder, varsayılan yol entegrasyonda AJAN A'nın kanonik
// implementasyonuyla birebir değiştirilir (girdi imzası dondurulmuş
// sözleşmeden kopyadır — dosya takası saf kalır).

import type { ImportScanResult } from '../importgraph/scan';
import type { RemapReport } from './schema';

export interface AnalyzeRemapInput {
    projectId: string;
    sourceRevision: string;
    generatedAt: string;
    scan: ImportScanResult;
    renderedNodePaths: string[];
}

export function analyzeRemap(_input: AnalyzeRemapInput): RemapReport {
    throw new Error('INTEGRATION: replace with AJAN A canonical implementation');
}
