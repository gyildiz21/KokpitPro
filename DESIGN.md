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

## D5 · Dağıtım Yolu — Yerel-önce; SaaS'a ve açık-kaynağa hazır (Patron kararı 2026-08-24)

1. **Bugün yerel-önce:** statik kabuk tarayıcıda açılabilir; gerçek yerel repo
   doğrulama, indeks ve kalıcı kayıt için `kokpit/server.ts` zorunludur. Yerel
   repo verisi kullanıcı açıkça GitHub/harici model bağlantısı seçmedikçe
   makineden çıkmaz.
2. **SaaS'e evrim sınırı şimdiden çizilir:** tüm LLM/storage erişimi sunucu
   katmanında ve env ile yapılandırılır; Kokpit-IR şeması sürümlüdür
   (`schemaVersion`); kimlik/asıl veri istemci paketine gömülmez.
3. **Açık-kaynak olasılığı:** MIT LICENSE ilk günden mevcuttur; gizli değerler
   yalnız `.env`'dedir; kişisel ad/e-posta kaynak ağacına girmez
   (`personalEmailYasak` deseninin genellemesi).
4. Bu karar tek-başına SaaS taahhüdü DEĞİLDİR — yalnızca bugünkü seçimlerin
   o kapıyı kapatmamasıdır.

## D6 · Kanıt yaşam döngüsü ve etkileşim durumu

1. **Tek güncellik gerçeği:** yerel proje için katalog, üst bağlam, harita,
   delta ve denetçi `kokpit/projects/local.ts` tarafından canlı Git makbuzuyla
   türetilen aynı `ready/stale/error` kararını tüketir; kalıcı kayıttaki eski
   `ready` değeri arayüzde ayrı bir gerçek gibi sunulmaz.
2. **Tarih-delta sınırı:** son iki ölçülmüş graf anlık görüntüsü proje bazında
   `.kokpit/data/delta-history.json` altında atomik yazılır. Karşılaştırma yalnız
   bu iki gerçek ölçüm arasında yapılır; taban yoksa `comparison-baseline-unavailable`
   korunur ve ilişki uydurulmaz. Proje silindiğinde ona ait delta geçmişi de
   aynı API yaşam döngüsünde silinir.
3. **Etkileşim kanıtı:** grup açıklaması deterministik yol sınıflandırmasıdır;
   kenar ayrıntısı yalnız ölçülmüş import kaydından gelir. Çalışma-zamanı akışı,
   sahiplik veya ticari etki bu yüzeylerden çıkarılmaz.
4. **Makbuz-kapsamlı görünüm:** zoom/pan, faz filtresi, harita araması ve seçili
   düğüm/grup/kenar `projectId + revision` anahtarıyla oturumda tutulur. Proje
   veya makbuz değişince eski bağlam yeni grafa taşınmaz.

## D7 · Remap önerisi — insan-inceleme adayı (bağlayıcı karar, 2026-08-29)

1. **Remap önerisi ölçülmüş kanıttan türetilen insan-inceleme adayıdır;
   repository gerçeği veya otomatik değişiklik değildir.** Öneri hiçbir
   yüzeyde ölçülmüş gerçeklik, uygulanmış değişiklik, ihlal veya kesin
   mimari hüküm gibi sunulmaz.
2. Öneriler salt okunur ve kopyalanabilirdir; ürün yüzeyinde `Uygula`,
   `Taşı` veya otomatik düzeltme eylemi yoktur. Her öneri kaynak revision
   ve ölçülmüş kanıt (metrik + ilgili yollar/gruplar) taşır.
3. Eşikler (büyük dosya, ortak import, katmanlar-arası inceleme) repo
   üzerinde ölçüm koşusundan sonra sabit sayılarla dondurulur ve tek bir
   motor modülünde gerekçesiyle yaşar; UI eşik veya magic number taşımaz.
4. İzin verilen katman bağımlılık matrisi mevcut değilse kesin `yanlış
   katmanda` hükmü ÜRETİLMEZ; yalnız ölçülmüş, deterministik
   `cross-layer-placement-review` (yerleşimi gözden geçir) dili kullanılır
   ve otomatik hedef klasör uydurulmaz.
