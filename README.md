# KokpitPro — Faz-Farkındalı Geliştirme Kokpiti

> Ajan-native repolar için **faz belgesinden okuyan**, kodlanan kısmı ve
> planlanan dilimlerin haritadaki yansımasını tek yüzeyde gösteren geliştirme
> kokpiti. Araştırma ve gerekçe: `MethodLogos_Pro/docs/arastirma/kokpit/`.

## Ne yapacak (v1 hedefi)

1. **Faz-Belge Ayrıştırıcı** — `ROADMAP.md` checkbox'ları, faz dosyası durum
   satırları, GO/kapı kayıtları → yapılandırılmış `PhaseSlice[]` JSON
2. **Canlı Mimari Haritası** — import-grafı + dosya ağacı → Mermaid/React-Flow;
   düğümler faz durumuna göre boyanır (kodlandı / sürüyor / planda)
3. **Delta Ön-Görünümü** — bir faz adımı seçilince etkilenen düğüm/kenar/test
   listesi **kodlanmadan** görünür
4. **Remap Önerileri** — import grafiği + dizin sezgilerinden yeniden düzenleme
   önerileri

## Düzen

```
KokpitPro/
├── README.md            ← bu dosya
├── PLAN.md              ← uygulama dilimleri ve kabul kriterleri
├── .gitignore
└── gitdiagram/          ← referans motor (MIT, upstream korunur)
```

`gitdiagram/` yalnızca **referans motordur**: AST→Mermaid derleyicisi,
doğrulama katmanı ve UI desenleri oradan öğrenilir/adapt edilir. Kokpit kendi
kök reposunda büyür; upstream güncellemeleri `cd gitdiagram && git pull
upstream main` ile alınır.

## Çalışma kısıtı (şimdilik)

Bu makinedeki WSL kabuğunda Node çalışmıyor → `npm install`, dev-server ve
testler Windows terminalinde koşulur:

```
cd gitdiagram
npm install        # veya: bun install
npm run dev
```

## Durum

- [x] Araştırma paketi (5 rapor)
- [x] Repo iskeleti
- [x] Dilim 1 kodu: parser (roadmap+phaseFiles) + Zod sözleşme + CLI + i18n temeli
      *(koşum Windows terminalinde — bkz. PLAN.md Dilim 1 uyarısı)*
- [ ] Dilim 0: GitDiagram motorunu yerelde ayağa kaldırma (Windows terminal)
- [ ] Dilim 2: Harita + Durum Boyaması (+ D1 i18n disipliniyle ilk bileşenler)
