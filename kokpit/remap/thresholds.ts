// AJAN B entegrasyon kopyası — kanonik sürüm AJAN A dalındadır; birleştirmede
// AJAN A sürümü alınır.
//
// Remap eşikleri — DESIGN D7#3: eşikler repo üzerindeki ölçüm koşusundan sonra
// dondurulur ve yalnız bu modülde gerekçesiyle yaşar; UI eşik veya magic
// number taşımaz. Gerekçeler PLAN.md "Ölçüm tabanı" (KokpitPro @ 7d1501a)
// bölümündeki ölçülmüş dağılımlardandır.

export const REMAP_THRESHOLDS = {
    largeFile: { minLines: 400, minBytes: 16384 },
    sharedImport: { minImporterFiles: 4, minImporterGroups: 2 },
    crossLayerPlacementReview: { minForeignImporterGroups: 2 },
    maxSuggestions: 24,
} as const;
