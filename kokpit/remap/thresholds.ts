// Remap eşikleri — Dilim 4, DESIGN D7.
//
// Buradaki sayılar uydurma değildir: KokpitPro gerçek kaynak ağacı üzerinde
// 2026-08-29 tarihinde, `7d1501a` tabanındaki ölçüm koşusundan dondurulmuştur.
// Ölçüm tabanı: 71 taranan dosya · 33 uygun üretim dosyası · 186 ölçülmüş kenar.
//
// - Üretim dosyası satır dağılımı p50=137, p75=236, p90=355, p95=421, max=426:
//   minLines=400 ölçülen kuyruğun (≈p95) başına oturur; gerçek kuyruk
//   dosyaları (server.ts=426, check/index.ts=421) yakalanır, gövde dokunulmaz.
// - minBytes=16384 (16 KiB) aynı kuyruğun bayt karşılığıdır (ölçülen
//   p95=17902); satır sayısına güvenilemediğinde ikinci bağımsız kanıttır.
// - Üretim fan-in dağılımı p50=1, p90=4, p95=6, max=11: minImporterFiles=4
//   ölçülen p90'ın ta kendisidir; ortak-modül adayı p95'i beklemeden çıkar.
// - Düğüm başına farklı importer mimari grubu p50=1, p75=2, max=3:
//   minImporterGroups=2 ve minForeignImporterGroups=2, dağılımın üst
//   yarısını inceleme adayı sayar; tek grup tek başına kanıt değildir.
// - maxSuggestions=24 panel patlaması nöbetçisidir; aşan adaylar `truncated`
//   işareti ve `suggestions-truncated` nedeniyle dürüstçe kırpılır.
//
// Bu nesne tek doğruluk kaynağıdır: eşik sayıları bu dosyanın dışında
// (özellikle UI'da) ASLA tekrarlanmaz ya da yeniden hesaplanmaz.

export const REMAP_THRESHOLDS = {
    largeFile: { minLines: 400, minBytes: 16384 },
    sharedImport: { minImporterFiles: 4, minImporterGroups: 2 },
    crossLayerPlacementReview: { minForeignImporterGroups: 2 },
    maxSuggestions: 24,
} as const;
