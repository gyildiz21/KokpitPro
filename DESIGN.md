# KokpitPro — Tasarım Sözleşmesi

> **Tarih:** 2026-08-24 · Patron kararıyla bağlayıcıdır. Bu dosya UI kodu
> yazılmadan ÖNCE yazıldı — MethodLogos dersini uyguluyoruz: terim/karar
> yazıldığı gün uygulanmazsa sonraki her dilim onu ihlal eder.

## D1 · Dil Politikası — BAŞTAN İKİ DİLLİ

1. Arayüz **Türkçe + İngilizce** çift dilli tasarlanır; tek-dil yapıp sonra
   çevirmek değil, i18n iskeleti ilk günden kurulur.
2. **Kullanıcıya görünen hiçbir metin bileşende hardcode edilmez** — yalnız
   `kokpit/i18n/` sözlüklerinden gelir. Nöbetçi test sözlük anahtarı
   hardcode'u ve tr/en anahtar paritesini denetler.
3. Varsayılan dil **TR** (kurucu kullanıcı), EN tam pariteyle sürdürülür.
4. **JSON/makine çıktıları yerelleşmez**: CLI ve Kokpit-IR alan adları
   İngilizce sabittir (makine sözleşmesi); yerelleşme yalnız sunum
   katmanındadır.
5. Terminoloji ilkesi: TR'de akademik/geliştirici yerleşik terimler korunur,
   zorlama öz-Türkçeden kaçınılır (ör. "faz", "harita", "ön-görünüm" doğaldır;
   "kokpit" marka olarak kalır).

## D2 · UX Kalite Barı — "Referanstan iyi"

Referans motorun (GitDiagram) UX'i yetersiz bulunmuştur. Kokpitin asgari barı:

| # | Kural |
|---|---|
| 1 | **Tek bakışta durum:** üç faz rengi (kodlandı/sürüyor/planda) + kalıcı görünür lejant; renk tek başına bilgi taşımaz (renk-körü dostu: etiket de vardır) |
| 2 | **Her düğümden kaynağa:** tıklanınca ilgili dosya/satır açılır (GitDiagram'ın en iyi fikri — korunur ve iyileştirilir) |
| 3 | **Dürüst boşluk:** veri yoksa/çözülemediyse sahte dolgu YOK; "bu bölüm için veri yok" açıkça yazar |
| 4 | **Klavye + odak:** harita gezinmesi klavyeyle çalışır; odak halkası görünür |
| 5 | **Sakin dergi estetiği:** MethodLogos tasarım sisteminin ruhu miras (açık zemin, yüksek kontrast, anlam taşımayan süs yok) — ama bağımsız kimlik; rakip/referans kopyası değil |
| 6 | **Yoğunluk disiplini:** ekranda aynı anda en fazla üç bilgi katmanı; detay çekmecede açılır |

## D3 · Render Kararı (Dilim 2'de kesinleşir)

- İnteraktif harita: **React Flow** (düzen kontrolü, overlay kolaylığı)
- Statik ihrac: **Mermaid** (GitDiagram'ın deterministik derleyicisi deseni)
- Ağır graf düzenlemesi kendi elimizle değil; kütüphane + bizim sözleşme

## D4 · Ajan-Native Bağış

Repolar arası format standardı `AGENTS.md` ekosistemidir; kokpit çıktısı
gelecekte AGENTS.md'e "mimari durum" bloğu yazabilme capability'sine yol
açacak şekilde tasarlanır (yazma izni ayrı GO konusu).
