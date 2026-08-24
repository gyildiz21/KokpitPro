# KokpitPro — Uygulama Planı

> Kaynak: `docs/arastirma/kokpit/05-senaryolar-ve-oneri.md` (MethodLogos_Pro).
> Bu dosya kokpitin kendi faz defteridir — kokpit, kendisini de kendi
> metodolojisiyle geliştirir.
>
> **Bağlayıcı tasarım sözleşmesi:** `DESIGN.md` (D1: TR/EN çift dil baştan ·
> D2: UX barı "referanstan iyi" · D3: React Flow + Mermaid · D4: AGENTS.md
> bağışı). UI kodu yazan her dilim bu sözleşmeye tabidir.

## Dilim 0 · Motoru ayağa kaldırma (Windows terminalinde)

> **Koşum notu 2026-08-24:** `npm run dev` Windows CMD'de kırık (betik bash +
> Bun istiyor). Doğru yollar aşağıda.

- [ ] `gitdiagram/` içinde bağımlılıklar: **Tercihen** Bun kur
      (`powershell -c "irm bun.sh/install.ps1 | iex"`) → `bun install` ·
      Alternatif: `npm install`
- [ ] `.env.example` → `.env` kopyala; `OPENAI_API_KEY` (+ opsiyonel
      `GITHUB_TOKEN`) gir
- [ ] Dev sunucu — üç yol:
      1. Bun kurulduysa: `bun run --bun next dev --turbo`
      2. Node yolu: `npx next dev --turbo`
      3. Git Bash varsa: `"C:\Program Files\Git\bin\bash.exe" scripts/dev-turbo.sh`
- **Kabul:** `localhost:3000` açılır, örnek repo diyagramı üretilir;
  tıklanınca GitHub dosyasına gidiliyor.
- **Durum:** ❌ henüz koşulmadı (yukarıdaki komutlar kullanıcıda).

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
