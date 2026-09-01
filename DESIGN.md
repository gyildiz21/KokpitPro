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
5. **Özel inceleme yayını tek servistir (Patron kararı 2026-09-01):** arayüz
   ve `/api/*` aynı Node sürecinde ve aynı origin altında yayımlanır. Statik
   frontend + ayrı backend bölünmesi bugün yapılmaz; mevcut güvenlik ve kalıcı
   kayıt sınırı tek serviste daha açık ve doğrulanabilirdir.
6. **Bulut modu GitHub-only'dir:** `KOKPIT_DEPLOYMENT_MODE=cloud` yerel repo
   doğrulama/kayıt uçlarını kapatır, yerel kayıtları API'den süzer ve kaynak
   ağacı dosyalarını statik olarak servis etmez. Kullanıcının Windows checkout'u
   bulut sunucusunca görülemez; bunun gelecekteki yolu ayrı, açıkça yetkilendirilmiş
   yerel yardımcı/masaüstü köprüsüdür.
7. **Fail-closed erişim:** bulut başlangıcı HTTPS `KOKPIT_PUBLIC_ORIGIN` ve en
   az 24 karakterlik inceleme parolası olmadan başarısız olur. Host allowlist,
   same-origin mutasyon denetimi ve HTTP Basic erişim kapısı birlikte çalışır;
   health ucu kimlik istemez fakat dosya yolu veya sır döndürmez.
8. **Kalıcılık:** Railway staging tek instance + `/data` volume kullanır;
   `KOKPIT_DATA_DIR=/data`. JSON kayıt defteri bu özel inceleme için kabul
   edilir; çok-kullanıcılı SaaS için kimlik/tenant yetkilendirmesi ve yönetilen
   veritabanı ayrıca tasarlanmadan kamuya açık üretim ilan edilemez.
9. **Üretim zinciri:** Node 20, deterministik `npm ci`, esbuild sunucu bundle'ı,
   Docker runtime ve `/api/health` kapısı zorunludur. GitHub App private key
   yalnız Railway secret olarak sunucuya verilir; image'a veya Git'e girmez.

> **Adlandırma notu (2026-08-31):** Kod yorumlarında geçen **"D5.2"**
> kısaltması, yalnızca bu maddedeki (D5) **sürümlü şema** kararını işaretler.
> Bu bir DESIGN karar referansıdır ve PLAN.md'deki **"Dilim 5.2 — Gerçek
> Korpus Karar Bütünlüğü ve Açıklanabilir Kokpit"** ürün dilimiyle hiçbir
> ilişkisi YOKTUR. İkisi karıştırılmaz: D-kararları DESIGN kararlarıdır,
> "Dilim N" satırları PLAN ürün fazlarıdır.

## D8 · Açıklama katmanı — ExplanationEnvelope v1 (Dilim 5.2 sözleşmesi, 2026-08-31)

1. **Kullanıcı sonucu tespitle bitmez:** her faz, Uyum ve Delta kaydı
   `tespit → anlama → eylem → yeniden ölçüm/doğrulama` zincirini tamamlar.
   **Açıklama, ölçümden ayrı ve sürümlü bir katmandır.** `ExplanationEnvelope
   v1` (Zod `.strict()`) ComplianceReport v1, DiagramGraph v1 ve Delta
   sözleşmelerindeki **ölçülmüş gerçekleri tüketen** bir projection'dır;
   bu sözleşmelerin hiçbir alanı açıklama üretmek için sessizce değiştirilmez.
   Açıklama katmanı hiçbir ölçümlü kaydı ekleyemez, çıkaramaz, ciddiyetini
   veya durumunu değiştiremez.
2. **Zarif alanlar:** `schemaVersion`, `projectId`, `sourceRevision`,
   `subjectKind`, `subjectId`, `origin` (`deterministic | ai`), `summary`,
   `whatItMeans`, `whyItMatters`, `recommendedActions[]`,
   `verificationSteps[]`, `evidenceRefs[]`, `limitations[]`, `generatedAt`.
   `provider` / `model` / `confidence` alanları **yalnız `origin:'ai'`
   iken** bulunabilir; deterministik zarfta yasaktır. Kullanıcıya görünen
   metinler TR/EN çift kanallıdır (DESIGN D1); makine alan adları İngilizce
   sabittir.
3. **Deterministik taban zorunludur:** AI kapalıyken bütün kullanıcı yolculuğu
   deterministik TR/EN açıklama kataloğuyla çalışır; eksik alan veya boş kart
   üretilmez. Katalog teknik kodu tekrar etmek yerine sade anlamı, kullanıcı
   etkisini, ilk güvenli eylemi ve doğrulama adımını verir.
4. **AI yorumu opsiyoneldir ve sınırlıdır:** Repo bazında açık opt-in/GO
   olmadan çağrı yapılmaz; gerçek ücretli çağrı ayrı Patron GO'sudur. AI
   çıktısı ayrı bir **"AI YORUMU"** katmanında görünür; provider, model,
   `generatedAt`, `sourceRevision` ve `limitations` her zaman görünürdür.
   Kaynak revizyonu değişirse eski AI yorumu **bayat** sayılır ve servis
   edilmez. Sağlayıcı hatalıysa deterministik açıklama korunur; teknik hata
   kullanıcı kanıtı gibi sunulmaz. AI ölçülmüş import kenarı ekleyemez,
   ciddiyet değiştiremez, kayıt kapatamaz, çelişkiyi doğrulayamaz, Delta'yı
   `measured` yapamaz, otomatik kod değişikliği başlatamaz; olası yol/çözüm
   önerisi yalnız `ÖNERİ / PROPOSED` statüsünde olabilir.
5. **Uyum kuyruğu kullanıcı-önceliklidir:** satır sırası sade bulgu adı →
   etkilenen kayıt sayısı → neden önemli → önerilen eylem → ciddiyet;
   dosya yolu, `reasonCode`, `ruleReference`, `sourceRevision` ve teknik
   mesaj **"Teknik kanıt"** adlı açılır ikincil bölümde kalır. Aynı kurala
   ait tekrarlar kural+kapsam temelinde gruplanır; gruplama ölçülen kayıt
   sayısını değiştirmaz ve kullanıcı tekil satırlara inebilir. Defter
   senkronunda `near-miss/roadmapBox/handoff` kodları ilk katmanda gösterilmez;
   kullanıcı diline çevrilir (ör. "Plan kaydı ile teslim kaydı uyuşmuyor").
6. **Delta ve zaman dürüstlüğü sürer:** delta ölçülemediğinde boş beyaz alan
   yerine neden + eksik veri + güvenli eylem gösterilir (`stale-receipt` →
   Yeniden indeksle; `no-local-checkout` → yerel çalışma kopyası bağlama
   açıklaması; `no-mapping` → eşleme bağlama eylemi). Görünüm değişince
   ilgisiz denetçi bağlamı sıfırlanır veya seçili Delta maddesiyle eşleşir.
   Zaman görünümünde "Dilim 5" ve "Dilim 5.2" ayrı fazlardır; "kabul açık"
   ile "teknik motor yapılmadı" aynı şey gibi sunulmaz.

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
5. Başlangıçtaki canlı Git makbuzu tarama ve dosya ölçümü bittikten sonra
   yeniden doğrulanır. Çalışma ağacı koşum sırasında değiştiyse eski
   `sourceRevision` ile ölçülmüş sonuç yayımlanmaz;
   `unmeasurable/revision-changed-during-scan` döner ve yeniden indeks istenir.
6. Kapsam sayaçları anlamını gizlemez: `eligibleFiles` analiz edilen üretim
   dosyalarını, `scannedFiles` import taramasının tüm dosyalarını,
   `excludedFiles` ise test/fixture/generated olarak analiz dışı bırakılanları
   sayar.
