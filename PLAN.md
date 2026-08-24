# KokpitPro — Uygulama Planı

> Kaynak: `docs/arastirma/kokpit/05-senaryolar-ve-oneri.md` (MethodLogos_Pro).
> Bu dosya kokpitin kendi faz defteridir — kokpit, kendisini de kendi
> metodolojisiyle geliştirir.
>
> **Bağlayıcı tasarım sözleşmesi:** `DESIGN.md` (D1: TR/EN çift dil baştan ·
> D2: UX barı "referanstan iyi" · D3: React Flow + Mermaid · D4: AGENTS.md
> bağışı). UI kodu yazan her dilim bu sözleşmeye tabidir.

## Dilim 0 · Motoru ayağa kaldırma — B YOLU KARARLI (storage'sız lite)

> **Patron kararı 2026-08-24:** R2/Upstash hesap açılmayacak; referans motor
> `lite` dalında storage'sız çalışır. Uretilen diyagram önbelleklenmez, her
> ziyarette yeniden üretilir — Dilim 2 UI'sı için yeterli.

- [x] **`lite` dalı hazır** (`gitdiagram`, commit `1e1e8e9`):
      R2 okumaları "yapılandırılmamış = artefakt yok" sayar; Turbopack kökü
      sabitlendi; persistence zaten fail-safe'ti (uyarı bandı normaldir)
- [ ] `cd gitdiagram && git checkout lite`
- [ ] `.env.example` → `.env`; zorunlu tek alan: **`OPENAI_API_KEY`**
      *(alternatif: `AI_PROVIDER=openrouter` + `OPENROUTER_API_KEY`;
      önerilir: `GITHUB_PAT` — GitHub API limitini yükseltir)*
- [ ] Kurulum: `bun install` *(önerilen)* veya `npm install`
- [ ] **Yalnız bu dizinden** çalıştır: `bun run --bun next dev --turbo`
      *(veya Node ile `npx next dev --turbo`)*
- **Lite modda NORMAL görünenler:** `/api/healthz` 503 · üretim sonrası
  "could not be cached" uyarı bandı · artefakt önbelleği yok
- **Kabul:** ana sayfadan örnek/gerçek repo girildiğinde akışkan üretim
  çalışır, interaktif Mermaid haritası render edilir, düğüme tıklanınca
  GitHub dosyası açılır.
- **Durum:** ❌ koşulmadı — kullanıcı OPENAI_API_KEY girdikten sonra.

## Dilim 0.1 · Parser kabul koşumu

- [x] Fixture klasör adı `__fixtures__/` olarak eşitlendi (ENOENT giderildi)
- [x] **CLI gerçek-veri koşusu YEŞİL:** MethodLogos ROADMAP → 9 faz grubu /
      62 madde (5.7+P0..P5); phases dizini → 27 dosya tarandı, sinyaller üretildi
- [ ] `npm run test` yeniden koşulacak (labels 3/3 yeşildi; parser süitleri
      klasör düzeltmesinden sonra yeşil beklenir)

### v0.1 parlatma listesi (kabul sonrası)

1. **phaseFiles hassasiyeti:** "Güvenlik Düzeltmeleri", "Terim düzeltmesi",
   "plan değildir", "Plan — dilimler" gibi başlıklar yanlış-pozitif üretiyor →
   olumsuzlama koruması (`değildir` öncesi token yasak) + yapısal başlık
   istisnası ("Runtime açma kapısı") + Düzeltme için ✅/🔧 emoji veya tarih şartı
2. Çok satıra yayılan bold başlıklar (`**...**\n devam**`) başlığı kırpıyor →
   blok-bazlı bold çözümleme
3. `madde-N` kimlikleri dosya-geneli sayaçtan geliyor; faza-göre sıfırlama
   değerlendirilecek

## Dilim 0.2 · Dış denetim yanıtı (2026-08-24)

> Bağımsız kol (Windows terminali) KokpitPro'yu değerlendirdi: **1.5/5 PoC**.
> Bulgular ve durumları:

| # | Bulgu | Durum |
|---|---|---|
| 1 | Parser testleri fixture yolu bulamıyor (`fixtures` vs `__fixtures__`) | ✅ Zaten onarılmıştı (`c0b1136`, denetim eski HEAD'e bakmış) |
| 2 | **Faz-gruplama hatası:** PLAN.md tarzı `## Dilim N` dosyalarında Dilim 1–4 maddeleri Dilim 0'a yığılıyor | ✅ **Onarıldı:** her başlık artık grup sınırı; boş gruplar filtreleniyor; nöbetçi test eklendi |
| 3 | **17 TS hatası:** i18n literal tip daralması + roadmap.ts undefined riskleri | ✅ **Onarıldı:** `as const` kaldırıldı (Dict string genişliğinde), regex yakalama erişimlerine `??` fallback |
| 4 | CLI kendi PLAN.md'sini yanlış grupluyor | ✅ Madde 2 ile aynı kök neden |
| 5 | GitDiagram tam yolculuk çöküyor: `Missing R2_PUBLIC_BUCKET`, healthz 503 (config/provider/storage×2/redis) | ⬜ **Karar bekliyor:** (A) Cloudflare R2 + Upstash free-tier hesap açılıp `.env` doldurulur · (B) "storage'sız lite" dalı: artefakt kalıcılığı olmadan sadece üretim+görüntüleme — Dilim 2 UI'sını besleyecek minimum bu. Önerilen: önce B, ürünleşmede A |
| 6 | Turbopack yanlış workspace-root çökmesi | ⬜ gitdiagram dizininden çalıştırma kuralı (kök değil) + gerekirse `next dev --turbo` yerine düz `next dev` |
| 7 | Redis entegrasyon testi timeout | ⬜ Madde 5B ile düşer |

**Kapı:** Bu onarımlardan sonra kapıları **Windows kolu** koşar
(`npm run test && npm run typecheck`); yeşil teyidi gelmeden Dilim 1
KAPANMIŞ sayılmaz (koşum disiplini).

## Dilim 1 · Faz-Belge Ayrıştırıcı v0

- [x] `kokpit/parser/roadmap.ts` — checkbox satırlarını oku:
      `- [x] **#1 ...**` → `{id, title, status, completedAt, line}` ·
      `[~]` partial durumu dahil
- [x] `kokpit/parser/phaseFiles.ts` — `.agents/phases/*.md` başlık sinyalleri:
      UYGULANDI/KAPANDI/DOCS_LOCK/WAITING_HUMAN/GO… öncelik sıralı
- [x] Çıktı sözleşmesi: `kokpit/parser/schema.ts` (Zod: PhaseItem, RoadmapScan,
      FileSignal…) — Dilim 2–3 bu sözleşmeyi tüketir
- [x] Nöbetçi testler: `__tests__/roadmap.test.ts` (gerçek MethodLogos kesiti,
      3 durum + tarih + satır izlenebilirliği) · `phaseFiles.test.ts`
      (S1I kesiti, öncelik sırası + durumsuz başlık atlanır)
- [x] **CLI kabul aracı:** `kokpit/cli.ts` —
      `npx tsx kokpit/cli.ts --roadmap <yol> [--phases <dizin>] [--pretty]`;
      JSON anahtarları İngilizce sabit (makine sözleşmesi, bkz. DESIGN.md D1)
- ⚠️ **Kod yazıldı; koşum Windows terminalinde** (`npm install && npm run test`)
  — koşulmadan dilim kapanmış sayılmaz.
- **Kabul:** MethodLogos_Pro ROADMAP'ine CLI ile bakıldığında P0–P5 ve S1I
  D0–D4 durumları doğru çıkar.

## Dilim 2 · Harita + Durum Boyaması

> **D1 uygulaması bu dilimde başlar:** `kokpit/i18n/labels.ts` kuruldu
> (tr/en parite nöbetçili); bileşen metinleri yalnız sözlükten gelir.

- [ ] Import-grafı: `dependency-cruiser` ile TS/JS kenarları
- [ ] AST düğümü ↔ dizin eşlemesi → faz dilimi bağlama
- [ ] Renk sözlüğü: kodlandı(yeşil) / sürüyor(amber) / planda(gri) / GO bekliyor(mavi)
- **Kabul:** kendi reposunun haritasında en az 3 durum aynı anda görünür.

## Dilim 3 · Delta Ön-Görünümü

- [ ] Seçilen plan-adımının `paths` alanı → harita vurgusu + etkilenen test listesi
- [ ] "Bu dilim gelirse" kartı: yeni düğümler (kesikli), değişecek kenarlar
- **Kabul:** bir plan adımı seçildiğinde ön-görünüm kartı ve harita vurgusu
  birlikte çalışır.

## Dilim 4 · Remap Önerileri (v2'ye ertelenebilir)

- [ ] Büyük-dosya / ortak-import / eşleşmeyen-katman sezgileri
- [ ] Öneri listesi UI paneli

## Sabit kurallar (bu projede de geçerli)

1. Sahte kapı yok: capability yoksa yüzey çizilmez.
2. Her davranış değişikliği nöbetçi testle gelir.
3. Defter güncel tutulur: her dilimin kapanışı tarih+kanıtla buraya yazılır.
