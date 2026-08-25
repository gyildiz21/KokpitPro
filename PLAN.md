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
- [x] **CLI gerçek-veri koşusu YEŞİL:** MethodLogos ROADMAP → 8 checkbox grubu /
      62 madde (5.7+P0..P5); phases dizini → 27 dosya tarandı, sinyaller üretildi.
      Bu sayı ürünün kanonik Faz 1–9 sayısı değildir; kanonik faz adaptörü
      Dilim 2 kapsamında ayrıca bağlanacaktır.
- [x] **Windows kabul koşumu YEŞİL (2026-08-24):** `npm test` → 3 dosya,
      18/18 test; `npm run typecheck` → hata yok

### v0.1 parlatma listesi (kabul sonrası)

1. [x] **phaseFiles hassasiyeti:** "Güvenlik Düzeltmeleri", "Terim düzeltmesi",
   "plan değildir", "Plan — dilimler" gibi başlıklar yanlış-pozitif üretiyor →
   olumsuzlama koruması (`değildir` öncesi token yasak) + yapısal başlık
   istisnası ("Runtime açma kapısı") + Düzeltme için ✅/🔧 emoji veya tarih şartı
2. [x] Çok satıra yayılan bold başlıklar (`**...**\n devam**`) başlığı kırpıyor →
   blok-bazlı bold çözümleme
3. [x] `madde-N` kimlikleri faza göre sıfırlanır; tüketici kimliği
   `(phaseHeading, id)` bileşimidir ve bu birleşimin tekilliği nöbetçidir.

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
- ✅ **Windows kabul koşumu tamamlandı (2026-08-24):** `npm test` → 18/18;
  `npm run typecheck` → hata yok. **Bağımsız denetçi teyidi (aynı gün):**
  codex sonrası toplam **26/26 test + typecheck exit 0 bizzat koşuldu** ·
  tam kayıt: `docs/analiz/hazirlik-auditi-2026-08-24.md` §1.4.
- ✅ **Düzeltme sonrası yeniden kabul (2026-08-25, Node 20.20.2):**
  `npm run check:preview` + `npm run typecheck` + `npm test` → **37/37**;
  statik sır yolları canlı kontrolde 404, yabancı Host 403. Kişisel yerel yol
  içeren ekran görüntüleri yayımlanmadı; uzak koşum kanıtı GitHub Actions'tır.
- **Kabul:** MethodLogos_Pro ROADMAP'ine CLI ile bakıldığında P0–P5 ve S1I
  D0–D4 durumları doğru çıkar.

## Dilim 2.0 · Saf diyagram motoru nakli (AI'sız) — [hazirlik-auditi §3]

- [ ] `lib/diagram/graph-schema.ts` ← gitdiagram `features/diagram/graph.ts`
      (141 satır; kaynak zod^4 strictObject kullanıyor → zod^3 uyum nöbetçisi)
- [ ] `lib/diagram/compile.ts` ← `server/generate/graph.ts` validate+compile
      +stripUnknownNodePaths (473 satır; saf — I/O yok)
- [ ] `lib/diagram/mermaid-sanitize.ts` ← `mermaid-validator.ts` (343) + testleri
- [ ] Adaptör: proje düğümleri (`IndexReceipt.nodes`) → `DiagramGraph`
      *(eşleme tablosu: hazirlik-auditi §1.3/§4; status→tone sözlüğü §3.1
      belirteçlerine bağlanır)*
- **Kabul:** KokpitPro kendi reposunu AI çağrısı OLMADAN Mermaid haritası olarak
  çizer; ≥3 durum aynı ekranda görünür (Dilim 2 kabulüyle birleşir).
- Geçici köprü: UI'ya "GitDiagram'da aç" link-butonu [(a)=XS]; iframe istenirse
  lite dalına 1 satır CSP yaması.

## Dilim 2 · Harita + Durum Boyaması

> **D1 uygulaması bu dilimde başlar:** `kokpit/i18n/labels.ts` kuruldu
> (tr/en parite nöbetçili); bileşen metinleri yalnız sözlükten gelir.

- [ ] Import-grafı: `dependency-cruiser` ile TS/JS kenarları
- [ ] AST düğümü ↔ dizin eşlemesi → faz dilimi bağlama
- [ ] Renk sözlüğü: kodlandı(yeşil) / sürüyor(amber) / planda(gri) / GO bekliyor(mavi)
- **Kabul:** kendi reposunun haritasında en az 3 durum aynı anda görünür.

## Dilim 2.1 · Proje Merkezi + Repo Bağlantı Yaşam Döngüsü

> **UI sözleşmesi:** `UI-SPEC.md` v0.8 §12. Ana HTML artık aynı-köken Node
> servisine bağlıdır; proje kayıtları ve son başarılı indeks makbuzları
> `.kokpit/data/projects.json` içinde kalıcıdır.

- [x] **Proje Merkezi:** kayıtlı projeler; kaynak, dal,
      plan dosyası, bağlantı ve son indeks alanları; seçili proje bağlam paneli.
- [x] **Dört adımlı bağlantı:** Kaynak → Doğrula → İndeksle →
      Hazır; Yerel ve GitHub seçenekleri; geri/iptal/hata/başarı durumları.
- [x] **Proje seçici + bağlam izolasyonu:** KokpitPro, MethodLogos ve PageBlitz
      kalıcı indeksleri aynı çalışma alanında karıştırılmaz; değişimde
      faz/düğüm/denetçi sıfırlanır.
- [x] **Dinamik zaman çizgisi + tam-yükseklik kabuk:** etkin projenin tüm
      izlenebilir plan maddeleri üretilir; sabit 4 örnek satır ve alt boş bant yok.
- [x] **Karşılaştırma:** en az iki proje ayrı satırda; bilinmeyen
      değerler `—/ölçülemiyor`; tek birleşik sağlık yüzdesi yok.
- [x] **`ProjectRecord` kayıt defteri:** projectId, yerel kök/GitHub kimliği,
      dal, plan kaynakları, bağlantı durumu ve son indeks makbuzunu kalıcı tut.
- [x] **Yerel repo yardımcısı:** yazılan kökü `realpath` ile sınırlar;
      `.git`/dal/commit/plan doğrular; kök dışı plan yolu ve 2 MiB üstü planı reddeder.
- [x] **Yerel sunucu güvenlik sınırı:** `.env`, `.git`, `.kokpit`,
      `node_modules` ve `gitdiagram` statik servisten dışlanır; Host başlığı
      yalnız yapılandırılan yerel adres/porttur; saf nöbetçi + canlı HTTP kabulü vardır.
- [~] **GitHub App / GitHub Contents:** seçili repolar + `Contents: read` token
      üretimi sunucuda kodlandı; anonim halka açık repo kabulü gerçek API ile
      doğrulandı. Özel `gyildiz21` repoları için App ID/installation/private-key
      dış kurulumu henüz yok; PAT/parola formu yok ve sır ön yüze gitmez.
- [x] **Proje-bazlı gerçek indeks:** IR `projectId/repoRoot/branch/commit`
      alanları; başarısız yeni koşumda son başarılı IR bayat etiketiyle korunur.
- [x] **Gerçek karşılaştırma adaptörü:** proje özetleri aynı ölçüm sözleşmesinden
      gelmiyorsa ölçülemez; proje satırı etkin bağlama drill-through yapar.
- [~] **E2E kabul:** yerel ekle, halka açık GitHub doğrula, özel GitHub yetki
      hatası, proje değişimi, yeniden yükleme kalıcılığı ve veri
      sızıntısı nöbetçisi, 1440/1024/768 taşma ve klavye/odak senaryoları.
- [x] **2026-08-24 canlı kanıt:** 3 kalıcı yerel repo; KokpitPro `7/31`,
      MethodLogos `8/62` ham checkbox grubu, PageBlitz kanıt-defteri adaptörü
      `51/1057` ham belge grubu (kanonik ürün fazı sayılmaz); halka
      açık GitHub doğrula+kalıcı kaydet+yeniden yükle+temizle akışı; `26/26`
      test, typecheck, HTML sözdizimi ve aynı-köken API health yeşil.
- **Kabul:** kullanıcı en az bir yerel ve bir GitHub projesini kaydeder; proje
  değişiminde tüm analiz yüzeyleri aynı projectId'ye geçer; KokpitPro ve
  MethodLogos verisi aynı plan/harita/zaman/kanıt yüzeyinde birleşmez; bağlantı
  ve indeks kanıtı yoksa UI bunu hazır ürün olarak sunmaz.

## Dilim 3 · Delta Ön-Görünümü

- [ ] Seçilen plan-adımının `paths` alanı → harita vurgusu + etkilenen test listesi
- [ ] "Bu dilim gelirse" kartı: yeni düğümler (kesikli), değişecek kenarlar
- **Kabul:** bir plan adımı seçildiğinde ön-görünüm kartı ve harita vurgusu
  birlikte çalışır.

## Dilim 4 · Remap Önerileri (v2'ye ertelenebilir)

- [ ] Büyük-dosya / ortak-import / eşleşmeyen-katman sezgileri
- [ ] Öneri listesi UI paneli

## Dilim 5 · Uyum Telemetrisi (UI-SPEC §10) — [hazirlik-auditi: SAHİPSİZ bulgusuna sahip çıktık]

- [ ] IR v0.2 şema genişlemesi: `sync[]` · `violations[]` · `conflicts[]` ·
      `health{}` (UI-SPEC §10.6 alanları, Zod'lu)
- [ ] Denetçi modüller: `kokpit/check/sync.ts` (defter senkronu + near-miss
      gerekçesi) · `kokpit/check/rules.ts` (başlangıç seti: koşumsuz-commit,
      hardcode-metin, hex-in-component, sahte-kapı, bayat-kutu, ks-band)
      · `kokpit/check/conflicts.ts` (karar-defteri ↔ ROADMAP çaprazı)
- [ ] Uyum sekmesi mock → gerçek IR verisi; triage kuyrukları (Yeni/Regress/
      Yükselen/Gerekçeyle-kapalı); kapatma akışı zorunlu gerekçe+kim+zaman
- **Kabul:** MethodLogos verisinde pano ≥1 gerçek ihlal ve ≥1 çelişkiyi
  yakalar; her çipten drill-through ≤2 tıklama (UI-SPEC §10.7).

## Sabit kurallar (bu projede de geçerli)

1. Sahte kapı yok: capability yoksa yüzey çizilmez.
2. Her davranış değişikliği nöbetçi testle gelir.
3. Defter güncel tutulur: her dilimin kapanışı tarih+kanıtla buraya yazılır.
