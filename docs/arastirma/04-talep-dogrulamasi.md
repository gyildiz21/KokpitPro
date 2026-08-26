# 04 · Talep Doğrulaması — "Başkaları da ister mi?"

> **Tarih:** 2026-08-24 · Yöntem: kamuya açık büyüme verileri + vaka analizleri.
> Sınırlama: bu turda derin API-metrik çekimi yapılmadı; sayılar erişilen
> sayfalardaki ilan edilmiş değerlerdir.

## 1. Doğrudan talep kanıtları (pozitif)

| Kanıt | Değer | Anlam |
|---|---|---|
| GitDiagram yıldız/fork | **15.908★ / 1.230 fork** (Ocak 2025'te ~9k idi → 20 ayda ~%75 büyüme) | Repo→harita ihtiyacı kitlesel ve sürekli |
| Lansman patlaması | HN ön sayfa (zirve #10, 222 puan) · 6 toplulukta #1 · PH gün-#2 · **24 saatte 25.000+ kullanıcı** | "Kodu görselleştir" anlık viral çekim üretiyor |
| GitHub Trending | #1 tüm diller (30 Mar 2025) + Trendshift günlük/haftalık listeleri | Tek seferlik hype değil; tekrarlayan görünürlik |
| DeepWiki ölçeği | 50.000+ repo indeksli, ücretsiz katman, MCP entegrasyonu ile ajan ekosistemine açıldı | AI-repo-anlama kategorisi kurumsal oyuncu tarafından taahhüt edildi |
| Yeni kategori doğuşu | data-loom · dev-harness · StrayMark Loom · CodeAtlas · ArchSteer — hepsi 2025–26'da ortaya çıktı | Kullanıcının tarif ettiği kokpit fikri **birden fazla bağımsız ekip tarafından aynı anda** keşfedildi = gerçek ihtiyaç sinyali |

## 2. Ölüm vakasının dersi (negatif kanıt)

**CodeSee** (2020–2024): 10M$ yatırım (Matrix, Boldstart) → Şubat 2024'te ticari
kapanış → Mayıs 2024 GitKraken satın alımı, standalone ürün gömüldü.

Kurucunun kendi ifadeleri + vaka analizi:
1. **"Vitamin vs painkiller"**: binlerce ücretsiz kullanıcı vardı, ödemeye
   çevrilemedi — kod-anlama aracı "olunca güzel", acil değil algısı.
2. **Kapsam genişliği tuzağı**: derin kapsamak için daha çok IDE/dil/stack =
   uzun para yakma dönemi; gelir bu hızı taşıyamadı.
3. **GenAI çift-edici**: hem yardımcı hem rekabet; kod hacmi patlarken
   farklılaşma zorlaştı.

**Kokpit projesi için okuma:** Bu üç ders, *ücretli SaaS* modelini değil,
**self-host hafif araç + kişisel akış** modelini destekler. Tek geliştiricinin
riski tam tersi yönetilebilir: kapsam tek stack'e (TS/JS) sabit, kullanıcı
tek (önce kendisi), para baskısı yok.

## 3. Kalan belirsizlikler (dürüstlük)

1. Yeni dalga araçlarının (data-loom, dev-harness, Loom) yıldız/kullanıcı
   sayıları bu turda ölçülmedi → niş talebin *büyüklüğü* değil *varlığı*
   kanıtlandı. İkinci turda bunların trendleri çekilmeli.
2. Türkçe arayüz talebi için veri yok; hedef kitle TR akademisyen/geliştiriciyse
   farklılaşma olabilir ama küresel talep göstergesi sayılmaz.
3. "Faz-belge-okuyan kokpit" için doğrudan arama-talebi (search volume) yok —
   kategori yeni olduğu için insanlar henüz bu isimle aramıyor; talep komşu
   sorgulardan (codebase visualization, architecture diagram generator)
   çıkarsanmalı.

## 4. Sonuç

**Talep var; iki katmanda:**
- **Geniş katman** (repo→anla): kanıtlanmış ve büyük — ama kalabalık.
- **Niş katman** (faz-planı ↔ harita kokpiti): yeni doğuyor, oyuncular henüz
  küçük/çapraz, standart format bağlantısı (AGENTS.md/faz dosyaları) kimsede
  yerleşik değil → **farklılaşma fırsatı burada**, ürünleşme kapısı koşullu
  açılabilir (bkz. `05-senaryolar-ve-oneri.md` §4).
