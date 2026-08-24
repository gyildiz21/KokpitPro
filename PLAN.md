# KokpitPro — Uygulama Planı

> Kaynak: `docs/arastirma/kokpit/05-senaryolar-ve-oneri.md` (MethodLogos_Pro).
> Bu dosya kokpitin kendi faz defteridir — kokpit, kendisini de kendi
> metodolojisiyle geliştirir.

## Dilim 0 · Motoru ayağa kaldırma (Windows terminalinde)

- [ ] `cd gitdiagram && npm install`
- [ ] `.env.example` → `.env` kopyala; OpenRouter/OpenAI anahtarı gir
      *(anahtar istenmiyorsa MOCK yolu var mı kontrol edilecek)*
- [ ] `npm run dev` → `localhost:3000` açılır, örnek repo diyagramı üretilir
- **Kabul:** herhangi bir public repo için interaktif Mermaid haritası
  görüntüleniyor; tıklanınca GitHub dosyasına gidiliyor.

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
- ⚠️ **Kod yazıldı; koşum Windows terminalinde** (`npm install && npm run test`)
  — koşulmadan dilim kapanmış sayılmaz.
- **Kabul:** MethodLogos_Pro ROADMAP'inde çalıştırıldığında P0–P5 ve S1I
  D0–D4 durumları doğru çıkar.

## Dilim 2 · Harita + Durum Boyaması

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
