# KokpitPro — Uygulama Planı

> Kaynak: `docs/arastirma/kokpit/05-senaryolar-ve-oneri.md` (MethodLogos_Pro).
> Bu dosya kokpitin kendi faz defteridir — kokpit, kendisini de kendi
> metodolojisiyle geliştirir.
>
> **Bağlayıcı tasarım sözleşmesi:** `DESIGN.md` (D1: TR/EN çift dil baştan ·
> D2: UX barı "referanstan iyi" · D3: React Flow + Mermaid · D4: AGENTS.md
> bağışı). UI kodu yazan her dilim bu sözleşmeye tabidir.

## Dilim 0 · Motoru ayağa kaldırma — B YOLU KARARLI (storage'sız lite)

> **Kapsam ayrımı (2026-08-25):** Bu dilim **referans doğrulama** kapısıdır —
> harici AI sağlayıcılı GitDiagram lite koşumunun uçtan uca görülmesi. Ana ürün
> kapısı DEĞİLDİR: Dilim 2.0 saf diyagram motoru AI çağrısı olmadan çalışır ve
> bu dilimin beklemesiyle engellenmez. Harici API/model çağrısı için ayrıca
> Patron GO'su gerekir. **GO 2026-08-26 tarihinde yalnız halka açık
> `gyildiz21/hayem-sistemi` reposu için verildi ve kabul koşumunda tüketildi.**

> **Patron kararı 2026-08-24:** R2/Upstash hesap açılmayacak; referans motor
> `lite` dalında storage'sız çalışır. Uretilen diyagram önbelleklenmez, her
> ziyarette yeniden üretilir — Dilim 2 UI'sı için yeterli.

- [x] **`lite` dalı hazır** (`gitdiagram`, taban `1e1e8e9`, yerel doğrulama
      commiti `d2bdfc9`):
      R2 okumaları "yapılandırılmamış = artefakt yok" sayar; Turbopack kökü
      sabitlendi; persistence zaten fail-safe'ti (uyarı bandı normaldir)
- [x] `cd gitdiagram && git checkout lite` — dal/HEAD doğrulandı:
      `lite · d2bdfc9`; üçüncü kişiye ait `upstream` remote'una push yapılmadı.
      Değişiklikler KokpitPro içinde `vendor-patches/gitdiagram-lite.patch`
      ve uygulama/doğrulama tarifiyle yeniden üretilebilir hâle getirildi.
- [x] `.env.example` → `.env`; zorunlu tek alan: **`OPENAI_API_KEY`**
      *(alternatif: `AI_PROVIDER=openrouter` + `OPENROUTER_API_KEY`;
      önerilir: `GITHUB_PAT` — GitHub API limitini yükseltir)* — anahtar değeri
      kayda alınmadan `AI_PROVIDER=openai` ve anahtar varlığı doğrulandı;
      `GITHUB_PAT` kullanılmadı.
- [x] Kurulum: npm bağımlılık ağacı mevcut ve gerçek koşumda kullanıldı
- [x] **Yalnız bu dizinden** çalıştır: `bun run --bun next dev --turbo`
      *(veya Node ile `npx next dev --turbo`)*
- **Lite modda NORMAL görünenler:** `/api/healthz` 503 · üretim sonrası
  "could not be cached" uyarı bandı · artefakt önbelleği yok
- [x] **Kabul (2026-08-26):** `gyildiz21/hayem-sistemi` (`main`,
      `6116a88`) ana sayfadan üretildi; OpenAI `gpt-5.6-terra` akışı 3 aşamayı
      tamamladı, interaktif Mermaid haritası render edildi ve `Firebase Client`
      düğümü gerçek `src/services/firebase.js` GitHub blob sayfasını açtı.
      İlk başarılı makbuz: `9d5f9443-65bf-4aec-a7ff-4fe8fd087586`, 31.762 sn,
      8.839 token. R2 bulunmadığı için kalıcılık uyarısı beklenen lite davranışıdır.
- [x] **Lite açılış onarımları:** ESM `next.config.js` kök çözümü, R2'siz boş
      cache okuması ve Upstash'siz tek süreç üretim kabulü regresyon testleriyle
      bağlandı. Üretimde Upstash yapılandırılmışsa iptal kaydı yine fail-closed'dur.
- **Kapılar:** `tsc --noEmit` ✅; hedefli 36/36 ✅; Docker/Redis entegrasyonu
  hariç tam paket 421/421 ✅. Docker Desktop çalışmadığı için 8 Redis testi bu
  makinede koşulamadı; bu lite kabulünü engellemez, dağıtık iptal/quota kanıtı
  değildir.
- **Durum:** ✅ **KAPANDI — storage'sız lite referans kabulü başarılı.**

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
| 5 | GitDiagram tam yolculuk çöküyor: `Missing R2_PUBLIC_BUCKET`, healthz 503 (config/provider/storage×2/redis) | ✅ **B yolu kabul edildi:** R2'siz okuma boş cache sayılıyor; üretim ve render çalışıyor, kalıcılık uyarısı beklenen lite sınırı |
| 6 | Turbopack yanlış workspace-root çökmesi | ✅ ESM-uyumlu mutlak Turbopack kökü ve nöbetçi testle onarıldı; koşum yalnız `gitdiagram` dizininden yapıldı |
| 7 | Redis entegrasyon testi timeout | 🟡 Docker Desktop çalışmadığı için 8 test koşulamadı; Redis dışı paket 421/421, lite kabulü başarılı; dağıtık iptal/quota ayrıca altyapılı ortamda doğrulanmalı |

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
  içeren ekran görüntüleri yayımlanmadı. GitHub Actions iş akışı hazırdır;
  ilk uzak iş kod adımlarına başlamadan hesap faturalama/harcama limiti nedeniyle
  engellendi (`run 32842069439`) ve yeşil kanıt sayılmadı.
- **Kabul:** MethodLogos_Pro ROADMAP'ine CLI ile bakıldığında P0–P5 ve S1I
  D0–D4 durumları doğru çıkar.

## Dilim 2.0 · Saf diyagram motoru nakli (AI'sız) — [hazirlik-auditi §3]

> **Yol kararı (2026-08-25):** `lib/diagram/*` yerine repo yapısına uygun
> `kokpit/diagram/*` kullanılır — tsconfig/vitest yalnız `kokpit/**` tarar,
> yapı sarsıntısı olmadan aynı kapsamda typecheck+test edilir.

- [x] `kokpit/diagram/graph-schema.ts` ← gitdiagram `features/diagram/graph.ts`
      (zod^4 strictObject → zod^3 `.strict()` uyumu nöbetçili; schemaVersion +
      metadata sözleşmesi eklendi; saf `validateDiagramGraph` duplicate/
      unknown-edge/missing-path kategorileriyle) · kanıt: 11 nöbetçi test
- [x] `kokpit/diagram/mermaid-sanitize.ts` ← `mermaid-validator.ts` fikrinin
      saf-string uyarlaması (safeMermaidId/escapeMermaidLabel/
      validateMermaidSource/buildFileLink) · kanıt: 32 enjeksiyon/determinizm
      nöbetçisi
- [x] `kokpit/diagram/compile.ts` ← `server/generate/graph.ts` validate+compile
      fikrinin saf uyarlaması (deterministik sıralama; güvenli ve dengeli
      `subgraph`; `classDef` kasıtlı dışarıda — sanitizer yönerge redline'ı) ·
      kanıt: derleme ve enjeksiyon nöbetçileri
- [x] Adaptör: gerçek import taraması (`IndexReceipt.groups` +
      `kokpit/importgraph`) → `DiagramGraph` + düğüm-başına makbuz
      (`receipt-adapter.ts`: projectId/dal/commit/revision/yol/faz/kanıt-türü;
      plan-path-match · measured-import hiyerarşisi; test/fixture dosyaları
      mimari düğüm değildir, doğrudan test importları maddeye bağlanır;
      checkbox tek başına kod kanıtı değil nöbetçili) · kanıt: 9 adaptör testi
- **2026-08-25 canlı kabul:** geçici portta KokpitPro kendi reposu AI çağrısı
  OLMADAN ölçüldü — 53 dosya tarandı, 34 düğüm / 48 kenar grafı, done·open·
  unmeasured 3 durum, 117 satır deterministik Mermaid (GitHub click linkli),
  makbuz `local-859d21494b4a · codex/dilim-2-real-map · 8821a1e`; sır yolları
  404, yabancı Host 403.
- **Kabul:** KokpitPro kendi reposunu AI çağrısı OLMADAN Mermaid haritası olarak
  çizer; ≥3 durum aynı ekranda görünür (Dilim 2 kabulüyle birleşir).
- Geçici köprü: UI'ya "GitDiagram'da aç" link-butonu [(a)=XS]; iframe istenirse
  lite dalına 1 satır CSP yaması.

## Dilim 2 · Harita + Durum Boyaması

> **D1 uygulaması bu dilimde başlar:** `kokpit/i18n/labels.ts` kuruldu
> (tr/en parite nöbetçili); bileşen metinleri yalnız sözlükten gelir.

- [x] **Import-grafı (`kokpit/importgraph/scan.ts`):** `dependency-cruiser` ile
      TS/JS kenarları; yalnız repo kökü içindeki gerçek üretim dosyaları mimari
      düğüm olur, Node çekirdek modülleri/test/fixture yüzeyi ayrılır;
      `/api/projects/:id/diagram` ölçümlü uç noktası canlıdır.
- [x] **Faz-kod-test eşlemesi (`kokpit/diagram/receipt-adapter.ts`):** tam yol
      alt-dizesi birinci kanıt; `itemMappings` ile madde→düğüm/yol/test,
      `unmatchedPlanItems` ile dürüst eşleşmeyen kayıt; seçilen fazın eşleşmesi
      yoksa bütün haritayı anlamsız biçimde karartmaz.
- [x] **Renk ve etkileşim (`kokpit/ui/map-flow.tsx`):** kodlandı(yeşil) /
      sürüyor(amber) / planda(gri) / GO bekliyor(mavi halka; yalnız görsel dil,
      faz kapısı DEĞİLDİR) yalnız `--st-*` belirteçleriyle; React Flow + Dagre
      bileşen paketleme, gerçek zoom/sığdır, ok tuşu seçimi ve metin etiketi canlıdır.
- [x] **GO-kapı yanlış-işaretleme nöbetçi düzeltmesi (2026-08-27):** yukarıdaki
      lejant anımı, madde gövdesi dışındaki bağımsız bildirim hariç artık kapı
      üretmez (`kokpit/parser/roadmap.ts` insideItemBody durum makinesi);
      HTML file:// fallback'i aynı kuralın aynasıdır; Dilim 0'ın harici-GO
      bildirimi etkilenmez. Kanıt: roadmap.test.ts ±2, ui-preview ±2 nöbetçi.
- **2026-08-25 canlı kabul:** gerçek KokpitPro haritasında done·open·unmeasured
  ≥3 durum aynı ekranda; düğümden GitHub blob kaynağına tıklama; proje
  değişiminde seçili düğüm/denetçi/diyagram sıfırlaması kodda. 1440/1024/768
  taşma turu ve TR/EN parite koşumu bu dilimi kapatmadan önce yapılacak.
- **2026-08-26 kapanış kabulü:** çalışma ağacı içerik-duyarlı makbuzla
  doğrulanır; bayat kayıt harita yerine yeniden indeks eylemi verir; GitHub
  kaynağı yalnız değişmez commit için açılır. 1440/1024/768, TR/EN, yatay taşma,
  düğüm çakışması, ok tuşları, dar panel odak tuzağı/odak iadesi Playwright ile
  geçti. `npm run typecheck` ve 12 dosyada **136/136** Vitest yeşildir;
  `vitest@4.1.11` yükseltmesinden sonra tam `npm audit` sonucu 0 açıktır.
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
- [x] **GitHub App / GitHub Contents (`kokpit/projects/github.ts`):** seçili repolar + `Contents: read` token
      üretimi sunucuda kodlandı; hermetik RSA/JWT → installation token → özel
      repo indeksleme olumlu yolu ve token önbelleği nöbetçiyle doğrulandı;
      anonim halka açık repo kabulü gerçek API ile doğrulandı. **2026-08-27
      negatif-yol sözleşmesi:** anonim özel repo
      `GithubVerificationError` ile ALGILANABİLİR 404 döner
      (`not-found-or-private`; auth/rate-limit/network ayrımı); hata metni
      sır-taşımaz, anonim modda Authorization başlığı gönderilmez; PAT/parola
      formu yok.
- [ ] **Gerçek özel-repo GitHub App kabulü:** `gyildiz21` repoları için App
      ID/installation/private-key dış kurulumu ve kimlikli gerçek-API olumlu
      turu henüz yok. Kod ve hermetik test bu harici yetki kanıtının yerine geçmez.
- [x] **Proje-bazlı gerçek indeks:** IR
      `projectId/repoRoot/branch/commit/revisionKind/revision` alanları; temiz
      commit ile kirli çalışma ağacı ayrılır; başarısız yeni koşumda son
      başarılı IR bayat etiketiyle korunur.
- [x] **Gerçek karşılaştırma adaptörü:** proje özetleri aynı ölçüm sözleşmesinden
      gelmiyorsa ölçülemez; proje satırı etkin bağlama drill-through yapar.
- [x] **Hermetik E2E kabul:** yerel ekle, halka açık GitHub doğrula, özel GitHub yetki
      hatası, proje değişimi, yeniden yükleme kalıcılığı ve veri
      sızıntısı nöbetçisi. 1440/1024/768 taşma, TR/EN, düğüm çakışması ve
      klavye/odak senaryoları 2026-08-26'da Playwright ile kapandı.
      **2026-08-27 negatif-yol turu:** `e2e/dilim-connect-github.spec.ts`
      S1 anonim-özel-repo dürüst 404 + kayıt defteri hazır-gibi kaydetmez,
      S2 halka açık akış regreasyonsuz (hermetik maskeler); S3 gerçek-API
      negatif turu `KOKPIT_REAL_GITHUB_PROBE=1` ile ayrı koşar —
      `gyildiz21/KokpitPro` anonim gerçek 404 doğrulandı (birim + E2E).
- [ ] **Kimlikli E2E kabul:** gerçek kurulum tokenıyla özel depo başarı akışı
      harici GitHub App kurulumu yapılana kadar açıktır.
      Özel GitHub App dış kurulumu bu maddenin kalanıdır.
- [x] **2026-08-24 canlı kanıt:** 3 kalıcı yerel repo; KokpitPro `7/31`,
      MethodLogos `8/62` ham checkbox grubu, PageBlitz kanıt-defteri adaptörü
      `51/1057` ham belge grubu (kanonik ürün fazı sayılmaz); halka
      açık GitHub doğrula+kalıcı kaydet+yeniden yükle+temizle akışı; `26/26`
      test, typecheck, HTML sözdizimi ve aynı-köken API health yeşil.
- **Kabul:** kullanıcı en az bir yerel ve bir GitHub projesini kaydeder; proje
  değişiminde tüm analiz yüzeyleri aynı projectId'ye geçer; KokpitPro ve
  MethodLogos verisi aynı plan/harita/zaman/kanıt yüzeyinde birleşmez; bağlantı
  ve indeks kanıtı yoksa UI bunu hazır ürün olarak sunmaz.

## Dilim 2.2 · Kanıtlı Semantik Mimari Katmanı

> **Sınır:** Bu dilim GitDiagram benzeri okunabilir mimari kümeleri ekler ama
> ölçülmeyen davranış uydurmaz. Kaynak gerçekliği `dependency-cruiser` import
> kenarlarıdır; yol-tabanlı rol etiketleri açıkça deterministik sınıflandırmadır.

- [x] **Mimari grup sınıflandırıcısı (`kokpit/diagram/architecture.ts`):**
      Arayüz, Backend ve API, Analiz motoru, Servisler ve entegrasyonlar, Veri
      ve depolama, Otomasyon ve iş akışları, Derleme ve dağıtım, Paylaşılan
      çekirdek; dizin eşleşmesi dosya adından önceliklidir.
- [x] **Ölçülmüş ilişki dili:** ok kaynaktan import ettiği hedefe gider; gruplar
      arası statik kenar `içe aktarır`, dinamik kenar `dinamik yükler`, type-only
      kenar `tür bağımlılığı` olarak TR/EN görünür; dinamik/type-only kesiklidir.
- [x] **React Flow mimari konteynerleri:** düğümler grup sınırları içinde Dagre
      ile yerleşir; gruplar arası ok ucu ve ilişki etiketi görünür; durum/kanıt
      boyaması aynen korunur.
- [x] **Mermaid paritesi:** aynı grup ve kenarlar güvenli, dengeli `subgraph`
      bloklarıyla deterministik ihraca girer; ham etiket enjeksiyonu reddedilir.
- [ ] **Opsiyonel AI semantik zenginleştirme (v2/ayrı oturum):** repo-bazlı
      açık GO olmadan çalışmaz; `AI yorumu` etiketi taşır; ölçülmüş kenarları,
      faz durumunu veya kanıt hiyerarşisini değiştiremez.
- **2026-08-27 canlı kabul (Node 20.20.2):** KokpitPro çalışma ağacında 6
  deterministik grup, 29/29 render düğümü, 42/126 render/ölçümlü kenar, 22
  etiketli ilişki ve 6 Mermaid `subgraph`; 1440/1024/768 TR/EN, ok ucu,
  kesikli ilişki, grup görünürlüğü, klavye ve taşma Playwright akışı geçti.
  `npm run typecheck` eşdeğeri ve 15 dosyada **159/159** Vitest Node 20'de
  yeşildir; `npm audit --omit=dev` sonucu 0 açıktır.
- **Kabul (v1 çekirdeği):** güncel indeksli gerçek repoda en az iki mimari grup,
  gruplar arası yönlü import ilişkisi ve TR/EN etiketleri aynı haritada; Mermaid
  ihracı aynı grupları taşır; graf içinde ölçülmemiş kenar bulunmaz.

## Dilim 2.3 · Etkileşimli Mimari Denetimi

> **UI sözleşmesi:** `UI-SPEC.md` v1.1 §5.0.2. Bu dilim GitDiagram'ın okunur
> haritasını KokpitPro'nun kanıt denetçisi ve proje/makbuz bağlamıyla birleştirir;
> ölçülmeyen çalışma-zamanı davranışı, sahiplik veya ticari etki uydurmaz.

- [x] **Grup denetçisi:** mimari grup kapsayıcısı klavye/işaretçiyle seçilir;
      sorumluluk açıklaması, içerdiği düğümler, gelen/giden ölçülmüş ilişkiler
      ve kanıtlı faz dağılımı sağ denetçide açılır.
- [x] **Kenar denetçisi:** ölçülmüş kenar seçilince kaynak/hedef yolu, statik ·
      dinamik · type-only türü, import kanıtı ve ölçülebilen ilgili testler
      açılır; çözülemeyen veya ölçülmeyen etki açıkça bilinmeyen kalır.
- [x] **Görünüm durumu sürekliliği:** kaynak dosyayı açıp aynı proje/makbuza
      dönünce zoom/pan, seçili grup/kenar/düğüm, faz filtresi ve arama korunur;
      proje ya da makbuz değişiminde güvenli biçimde sıfırlanır.
- [x] **Tek güncellik gerçeği:** Proje Merkezi, üst bağlam, Harita, Delta ve
      denetçi aynı sunucu-taraflı makbuz doğrulama sonucunu tüketir; eşzamanlı
      `güncel`/`bayat` çelişkisi mümkün değildir ve tek yeniden-indeks eylemi vardır.
- [x] **Gerçek-sunucu E2E kabulü:** 1440/1024/768, TR/EN, klavye/Escape,
      grup+kenar seçimi, geri dönüşte görünüm korunması ve yüzeyler-arası
      güncellik paritesi Playwright ile doğrulanır.
- **2026-08-27 kabul kanıtı (Node 20.20.2):** 16 dosyada **166/166** Vitest,
  TypeScript 0 hata ve Playwright **9/9** geçti. Gerçek sunucu turu harita
  aramasını, grup/kenar denetçisini, seçim+zoom geri yüklemeyi, gerçek
  plan→kod→test delta kartını ve kısa/uzun Windows yoluyla eklenen geçici Git
  reposunda `ready → stale → yeniden indeks → baseline'lı measured` akışını
  kapsar.
- **Kabul:** gerçek indeksli bir repoda kullanıcı bir gruptan ve bir ölçülmüş
  kenardan kanıta iner; kaynağı açıp döndüğünde bağlamını kaybetmez; bütün
  yüzeylerde tek ve tutarlı güncellik durumu görür.

## Dilim 3 · Delta Ön-Görünümü

- [x] **Delta motoru (`kokpit/delta`):** sürümlü `.strict()` sözleşme +
      deterministik `computeDelta` — measured / declared-only / unmeasurable
      hiyerarşisi; bildirilen grafta-karşılıksız yol → kesikli öneri düğümü
      (`edges-not-measurable-yet`, kenar uydurma YASAK); baseline verilmedikçe
      added/removed kenar hesaplanmaz (`comparison-baseline-unavailable`);
      bayat makbuz → `stale-receipt`; madde bulunamazsa `item-not-found`.
      Kanıt: 12 nöbetçi test (determinizm durationMs hariç JSON-eşitliği).
- [x] **Delta API:** `GET /api/projects/:id/delta?phase=&item=` — diyagramla aynı
      canlı-makbuz disiplini (`verifyLocalRevision`); bayatlık HTTP hatası değil,
      200 içinde dürüst sözleşme; proje-bağlamı doğrulanır; GitHub kaynağı
      `no-local-checkout`. Canlı kanıt: KokpitPro Dilim 1/madde-1 →
      affected node `kokpit/parser/roadmap.ts` + test `__tests__/roadmap.test.ts`,
      reasons:[comparison-baseline-unavailable]; MethodLogos Pro (bayat) →
      stale-receipt; working-tree makbuzda Mermaid'te click-link üretilmez.
- [x] **UI (Harita vurgusu + Denetçi/Panol kartı):** etkilenen düğümler
      `is-delta-hit` ile vurgulu; önerilen düğümler kesikli + ÖNERİ rozeti;
      bölümler ayrı (kod/test/öneri/kenar-değişimi/ölçülemeyen-gerekçe);
      proje değişiminde delta+vurgu sıfır; HTTP hatasında önceki dürüst boşluk
      korunur. TR/EN parite sözlükte; renk yalnız `--st-*`.
- [x] **Karşılaştırmalı tarih-delta:** `DeltaHistoryStore` son iki gerçek graf
      anlık görüntüsünü proje bazında `.kokpit/data/delta-history.json` altında
      atomik saklar; ikinci indeks sonrası eklenen/kaldırılan ölçülmüş kenarlar
      baseline ile hesaplanır. İlk ölçümde taban yoksa dürüst
      `comparison-baseline-unavailable` sınırı korunur; proje silme aynı
      yaşam döngüsünde o projeye ait geçmişi de kaldırır.
- [x] **2026-08-26 E2E kabulü:** Playwright hermetik mock'larla S1 measured
      vurgu+test listesi · S2 önerilen kesikli+uydurma-kenar-yok · S4 bayat→CTA
      · S5 proje-sıfırlama · S6 TR/EN parite · S7 klavye+Escape odak iadesi
      · S8 1440/1024/768 taşmasız — **7 passed**.
- [x] **2026-08-27 gerçek-sunucu kabulü:** maskesiz KokpitPro indeksinde plan
      maddesi → gerçek kod/test delta kartı; geçici gerçek Git reposunda ilk
      indeks → canlı kirlenme ile tek `stale` gerçeği → yeniden indeks → tarih
      baseline'lı measured delta akışı doğrulandı.
- [x] **2026-08-27 dikiş nöbetçileri (kapanış turu):** sunucu desenindeki gerçek
      halka (record→record→baselineFor→computeDelta) iki farklı makbuzla
      sıralı `{added:[node_c→node_a], removed:[node_a→node_c]}` ölçer;
      değişmeyen kenar kümesi listeleri BOŞ bırakır; son-iki pencere üçüncü
      ölçümde dürüst kayar (`kokpit/delta/__tests__/tarih-delta-seam.test.ts`,
      3 test) · tarayıcıda 'Eklenen kenarlar / Kaldırılan kenarlar' başlıkları
      ayrı görünür ve panel aynı içeriği aynalar (e2e **S3b**, süre 8→8'li
      süit) — toplam vitest **167/167**, playwright dilim-3 **8 passed**.
- **Kabul:** bir plan adımı seçildiğinde ön-görünüm kartı ve harita vurgusu
  birlikte çalışır — ✅ gerçek repoda bizzat doğrulandı (yukarıdaki canlı
  DELTA[measured] çıktısı).

## Dilim 4 · Remap Önerileri (v2'ye ertelenebilir)

- [ ] Büyük-dosya / ortak-import / eşleşmeyen-katman sezgileri
- [ ] Öneri listesi UI paneli

## Dilim 5 · Uyum Telemetrisi (UI-SPEC §10) — [hazirlik-auditi: SAHİPSİZ bulgusuna sahip çıktık]

- [x] **IR v0.2 şema genişlemesi:** `kokpit/check/schema.ts` v1 donduruldu —
      `violations[]` (kural ciddiyeti ≠ bağlam ciddiyeti; friction×severity
      sıralama; kapalı kayıt gerekçe+kim+zaman şartlı), `sync[]` (near-miss
      zorunlu: date-gap · content-hash-mismatch · version-field-missing ·
      phase-file-missing · slice-commit-missing), `conflicts[]` (candidate ·
      open-conflict · superseded-chain), `health{}` dört bağımsız bant,
      `sourceRevision` ve dosya-kapsam sayaçları. Zod 3 `.strict()`; **tek
      genel sağlık yüzdesi şema düzeyinde imkânsız**; `measurement`
      measured/partial/unmeasured ayrımı sessiz kesilmeyi engeller.
- [x] **Denetçi modüller:** `kokpit/check/rules.ts` (başlangıç seti: koşumsuz-
      commit, hardcode-metin, hex-in-component, sahte-kapı, bayat-kutu,
      ks-band-delinmesi
      — hepsi deterministik, id koşumlar arası kararlı), `kokpit/check/sync.ts`
      (faz dosyası × kutu × handoff üçlüsü + near-miss gerekçesi),
      `kokpit/check/conflicts.ts` (tarih+yön+konu kesişimli, insan incelemeli
      karar adayı +
      bozuk superseded zinciri), `kokpit/check/index.ts` (buildCompliance;
      github kökünde dürüst unmeasured), `kokpit/check/closures.ts` (atomik,
      revizyon-bağlı audit deposu + kapatma birleştirmesi). Dosya sınırı,
      dış-kök bağlantısı, kimlik çakışması ve revizyon kapanışı nöbetçileri var.
- [x] **Uyum sekmesi mock → gerçek IR verisi:** statik örnek satırlar
      silindi; yüzey yalnız `GET /api/projects/:id/compliance` (cache no-store)
      raporundan çizer. Triage kuyrukları Tümü/İhlal/Defter/Karar/Gerekçeyle-
      kapalı; Regres/Yükselen v1 iz-sürülmüyor (dürüst devre dışı + gerekçe
      toast). Kapatma `POST …/compliance/close`: gerekçesiz 400, bilinmeyen
      404, tekrar 409; gerekçe+kim+zaman `.kokpit/data/compliance-audit.json`
      atomik audit'e yazılır, aktif sağlık bantları yalnız açık kaydı sayar.
- **2026-08-28 yeniden denetim:** eski **49 ihlal / 8 açık çelişki** kapanış
  iddiası geri çekildi: tarama 400 dosyada sessiz kesiliyor, tüm faz dosyaları
  her dilime kanıt sayılıyor ve ilgisiz karar bölümleri çelişki üretiyordu.
  Güncel motor uygun kod kapsamını açıkça raporlar; kural kayıtları gerçek
  satırlara bağlıdır. KokpitPro kanıt koşumu **280/280 uygun kod dosyası**,
  **99 açık kayıt** (hex-in-component 39 · koşumsuz-commit 55 · sahte-kapı 4 ·
  hardcode-metin 1), **11 senkron near-miss** ve **0 insan incelemeli karar
  adayı** üretir. `partial` görünüm kapsam sayacını gösterir;
  `unmeasured` boş listeyi temiz gibi sunmaz. Drill-through, gerekçeli
  kapanış, TR/EN, klavye/Esc ve duyarlı yerleşim hermetik Playwright
  senaryolarıyla korunur.
- [ ] **Kabul:** ≥1 gerçek ihlal ölçülmüştür; ancak aynı doğrulanmış korpusta
      ≥1 gerçek çelişki adayı kriteri bugün karşılanmıyor. Aday uydurulmayacak;
      doğrulanmış bir karar/otorite çifti oluşana kadar Dilim 5 tam kabulü açıktır.
- [x] **2026-08-28 düzeltme kapıları:** bağımsız ajan `APPROVE_FIXES` kararıyla
      yukarıdaki bulguları yeniden değerlendirdi; Node **20.20.2** altında
      typecheck, Vitest **213 passed / 1 opt-in skipped**, tüm Playwright paketi
      **22 passed / 1 opt-in gerçek-API skipped**, önizleme senkronu ve
      `npm audit --omit=dev` (**0 açık**) doğrulandı. Bunlar dış GitHub App
      kurulumu veya gerçek çelişki korpusu kabulünün yerine geçmez.

## Sabit kurallar (bu projede de geçerli)

1. Sahte kapı yok: capability yoksa yüzey çizilmez.
2. Her davranış değişikliği nöbetçi testle gelir.
3. Defter güncel tutulur: her dilimin kapanışı tarih+kanıtla buraya yazılır.
