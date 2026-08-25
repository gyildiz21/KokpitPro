# KokpitPro — Ayağa Kaldırma Öncesi Kapsamlı Hazırlık Auditi

> **Tarih:** 2026-08-24 · HEAD `b9d0892` · **Yöntem:** 5 bağımsız maksimum-derinlik
> alt-ajan denetimi (sözleşme çizgisi / arayüz HTML / motor entegrasyonu / kalite
> kapıları / çekirdek kod) + Patron talebiyle çapraz kod karşılaştırması.
> Her bulgunun kanıtı ilgili bölümde dosya:satır veya koşum çıktısıdır.

> **2026-08-25 doğrulama eki:** Aşağıdaki §0–§5, `b9d0892` anındaki bulguları
> tarihsel olarak korur. K1–K7 uygulamasının ilk hali Windows'ta geçersiz bir
> test kaçışı nedeniyle typecheck/test kapısını geçemedi. Bu durum düzeltilip
> Node 20 altında yeniden ölçüldü; güncel sonuç ve kapanışlar §6'dadır.

---

## 0. YÖNETİCİ HÜKMÜ

> ### Sistem **ŞARTLI HAZIR** 🟡→🟢
> **Dilim 2 (harita + boyama) ayağa kaldırılabilir — ama 5 ön-ucuz kapıyla.**
> Çekirdek mimari sağlam ve disiplin kültürü koda geçmiş (kendi sözleşmesiyle
> kendini parse eden parser, kanıt-taşıyan kayıt, dürüstlük mimarisi). Testler
> bugün bağımsız denetçi tarafından **bizzat koşuldu: 26/26 yeşil + typecheck 0**
> — artık iddia değil, ölçüm. Ancak: (1) kritik bir güvenlik açığı, (2) sahipsiz
> büyük bir yüzey (§10 Uyum), (3) delta kimliğini tehdit eden üç açık parser borcu,
> (4) kopuk kanıt zinciri ve (5) sözleşme terim kaosu ayağa kaldırma ÖNCESİ
> kapatılmalıdır. Hepsi ≤1 gün toplam iş.

| Boyut | Puan | Not |
|---|---|---|
| Çekirdek kod mimarisi | 3.5/5 | PoC için güçlü; güvenlik yaması şart |
| Arayüz önizleme | 4.0/5 | Gerçek sunucu entegrasyonlu; token sözleşmesizliği dışında örnek kalitede |
| Motor (gitdiagram lite) | 3.5/5 | Saf çekirdek ~957 satır taşınabilir; healthz 503 tasarımı gereği |
| Sözleşme çizgisi | 🟡 Kısmen net | Çekirdek hat sağlam; damga+terim kaosu bulanıklaştırıyor |
| Kalite kapıları | 🟢 test/typecheck · 🔴 CI/kanıt-zinciri | Yeşillik tek-makine hafızasında |

---

## 1. ALAN RAPORLARI — ÖZETLER

### 1.1 Sözleşme Çizgisi → **KISMEN NET**

**İyi haber:** DESIGN.md gerçekten bağlayıcı ve PLAN ona cite ediyor; çoklu-proje
özelliği (`f4fb5ea`) üç sözleşmeye de eksiksiz işlenmiş; koşum kanıtları fiziksel
olarak var (output/*.png + `.kokpit/data/projects.json`).

**Bulanıklaştıran beş şey:**
1. **UI-SPEC iç çelişkisi:** başlıkta "🟢 UYGULANAN v0.8 bağlıdır", sonda onay
   kutusu ⬜ boş; §6'da eski Vite/React yapı bloğu donmuş hâlde duruyor.
2. **Dilim numarası çelişkisi:** UI-SPEC §1 "Uyum=Dilim 4, Remap=Dilim 5" diyor;
   PLAN'da Dilim 4=Remap, **Uyum'un dilimi yok** → en ağır sahipsiz yüzey bu.
3. **Terim kaosu:** README `PhaseSlice[]` der, kod `RoadmapScan`+`PhaseFileScan`
   diyor ("Kokpit-IR v0" yorumuyla), UI-SPEC "v1" diyor; HTML faz önekleri
   `D0-D4` ile DESIGN karar ID'leri D1-D5 çakışıyor; tek belgede 4 sürüm şeması.
4. **D5 borçları:** LICENSE dosyası yok (D5.3 "ilk günden" diyor),
   `schemaVersion` ne kodda ne testte (D5.2).
5. Kanıt zinciri: hiçbir belge `output/` yoluna atıf yapmıyor (grep=0).

### 1.2 Arayüz Önizleme → **4/5**

En iyi üçü: gerçek bağlantı akışı (/api/projects/verify → kalıcı makbuz —
sahte diyalog DEĞİL), dürüstlük mimarisi (Örnek etiketleri, `—`, motor-bağlı-değil
şeridi), a11y iskeleti (roving tabindex, reduced-motion, skip-link).
Kritik üçü: renk tokenları spec §3.1 ile birebir uyumsuz (`--st-*` yok, hex farklı);
çift i18n mekanizması (47 inline ternary + 31 ölü anahtar + TR aria-label kalıntıları
→ EN modda karma dil riski); klavye yarım (listbox ok/Esc yok, odak dönüşü yok,
28px dokunma, açık tema 3.57:1 kontrast).

### 1.3 Motor Entegrasyonu → **(c) Motor Nakli önerilir**

- kokpit/server.ts bağımsız :4173'te tam proje-API'si sunuyor; gitdiagram'a proxy YOK.
- gitdiagram lite: üretim için tek zorunlu anahtar `OPENAI_API_KEY` (**dolu** ✓);
  rate-limit fail-open; healthz 503 lite'ta tasarımı gereği normal.
- iframe köprüsü CSP ile ENGELLİ (`frame-ancestors 'none'`).
- **Önerilen:** (c) saf motor nakli ≈957 satır — graph-schema (141) +
  validate/compile (473) + mermaid-validator (343); AI katmanı opsiyonel ayrı
  dilim. Geçici köprü: (a) link-butonu (iframe istenirse lite'a 1 satır CSP yaması).
- IR ↔ Graph AST dönüştürme tablosu hazır (id-slug, label≤72, path normalize,
  status→tone sözlüğü kokpit katmanında).

### 1.4 Kalite Kapıları → **Testler GERÇEKTEN YEŞİL**

Bağımsız denetçi bugün bizzat koştu: **`npm test` → 26/26 passed (5 süit)** ·
**`npm run typecheck` → exit 0** (strict temiz: any=0, ts-ignore=0, non-null!=0).
"18/18" ve "26/26" iddiaları matematiksel olarak doğrulandı. **Ama:**
CI workflow yok 🔴 · `output/` .gitignore'da + PNG uzantılı dosyalar fiilen JPEG 🔴 ·
commit mesajlarında kanıt referansı sıfır 🔴 → yeşillik tek-makine hafızası.

### 1.5 Çekirdek Kod → **3.5/5, ŞARTLI HAZIR**

Onarım doğrulandı: her-başlık-grup-sınırı düzeltmesi mevcut + nöbetçili
(roadmap.ts:87-89). En iyi desenler: kendi-sözleşmesiyle-kendini-parse,
tek-IR-gürültülü-kırılma, kanıt-taşıyan kayıt (line/evidence her yerde).
**Kritik kusurlar:**
- 🔴 **GÜVENLİK:** statik servis `/gitdiagram/.env`'i (gerçek anahtar dosyası!)
  sunuyor — blocklist `/.git|/.kokpit|/node_modules` ile başlıyor, `.env` ve
  `gitdiagram` prefix'i yok (server.ts:133). Ek: Host doğrulaması yok → DNS-rebinding
  özel repo planlarını okuyabilir.
- 🟠 Registry pseudo-atomic (copy≠rename, kilit yok, bozuk dosya kalıcı kilitlenme).
- 🟠 Parser borç üçlüsü AYNEN AÇIK: phaseFiles yanlış-pozitifleri (FP aktif),
  çok-satırlı bold kırpma, **dosya-geneli `madde-N` sayacı** (Dilim 3 delta
  kimliğini doğrudan tehdit ediyor).

---

## 2. ÇAPRAZ KARŞILAŞTIRMA MATRİSİ

Okuma: her satır bir ürün yüzeyi; hücreler = sözleşme / kod / önizleme / motor durumu.

| Yüzey | UI-SPEC | PLAN | Kod | Önizleme HTML | Motor (lite) |
|---|---|---|---|---|---|
| Proje Merkezi | ✅ §12 tam | ✅ Dilim 2.1 [x]/[~] | ✅ projects/* + server API | ✅ gerçek akış | — |
| Harita + boyama | ✅ §1/§3 | ✅ Dilim 2 [ ] | ❌ yok | ✅ mock | 🟡 AST hazır |
| Delta | ✅ §5.2 | ✅ Dilim 3 [ ] | ⚠️ madde-N kararsızlığı tehdit | ✅ mock | — |
| **Uyum panosu** | ✅ §10 TAM | ❌ **SAHİPSİZ** | ❌ şema alanları yok | ✅ mock | — |
| Remap | ✅ §5.3 | ❌ "Dilim 5" yok | ❌ | 🟡 panel yok | — |
| Renk tokenları | ✅ §3.1 hex tanımlı | — | — | ❌ farklı hex, --st-* yok | — |
| i18n | ✅ D1 | — | ✅ labels çifte-kilitli | ⚠️ çift mekanizma | — |
| schemaVersion | ✅ D5.2 | — | ❌ YOK | — | — |
| LICENSE | ✅ D5.3 | — | ❌ DOSYA YOK | — | — |

**Matrisin tek cümlelik okuması:** *Sözleşme kodun ve önizlemenin önünde;
kod önizlemenin gerisinde; iki büyük yüzey (Uyum, Remap) sözleşmeli ama sahipsiz.*

---

## 3. MOTOR BİRLEŞİMİ İÇİN TEKNİK ALTYAPI → FAZ PLANI KARŞILIĞI

PLAN.md **Dilim 2.0** olarak eklenmesi gereken blok (entegrasyon denetiminin
önerisi, benimsenmiştir):

```
## Dilim 2.0 · Saf diyagram motoru nakli (AI'sız)          [M]
- [ ] lib/diagram/graph-schema.ts ← features/diagram/graph.ts (141 satır;
      zod^3 uyum nöbetçisi — kaynak zod^4 strictObject kullanıyor)
- [ ] lib/diagram/compile.ts ← server/generate/graph.ts validate+compile
      +stripUnknownNodePaths (473 satır)
- [ ] lib/diagram/mermaid-sanitize.ts ← mermaid-validator.ts (343) + testleri
- [ ] Adaptör: IndexReceipt.nodes → DiagramGraph (eşleme tablosu entegrasyon
      raporu §4; status→tone sözlüğü §3.1 belirteçlerine bağlanır)
- Kabul: KokpitPro kendi reposunu AI çağrısı OLMADAN Mermaid haritası olarak
  çizer; ≥3 durum aynı ekranda görünür (Dilim 2 kabulüyle birleşir).
```

Geçici görüntüleme köprüsü (nakil bitene dek): kokpit UI'sına "GitDiagram'da aç"
link-butonu [(a)=XS]; iframe istenirse lite dalına 1 satır CSP yaması.

---

## 4. AYAĞA KALDIRMA ÖNCESİ ZORUNLU KAPI SETİ (sıralı)

| # | İş | Neden şimdi | Emek |
|---|---|---|---|
| K1 | 🔴 server.ts blocklist'e `.env` + `gitdiagram` ekle + Host header doğrulaması | Gerçek anahtar dosyası şu an servis ediliyor | XS |
| K2 | `madde-N` sayacı faz-kapsamlı yap + fixture | Dilim 3 delta kimliği buna oturur; sonra değiştirmek kırıcı | S |
| K3 | phaseFiles olumsuzlama koruması (`değildir` lookahead, yapısal başlık istisnası, Düzeltme için emoji/tarih şartı) | FP'ler Dilim 2 renk sözlüğüne sızacak | S |
| K4 | UI-SPEC damga birliği: onay kutusu imzala veya bölünmüş damga; §6 Vite kalıntısını gerçek stack lehine yeniden yaz; Uyum=Dilim 5 / Remap=v2 düzeltmesi; Terim Sözlüğü §0.1 (RoadmapScan kanonik) | Tek-hükümlük çizgi | XS-M |
| K5 | PLAN'a "Dilim 5 · Uyum Telemetrisi" + "Dilim 2.0 Motor Nakli" ekle | Sahipsiz yüzey + birleşme yolu planda görünür olmalı | XS |
| K6 | LICENSE (MIT) + parser/schema.ts'e `schemaVersion:1` + nöbetçi test | D5'in açık borçları | XS |
| K7 | ci.yml (25 satır) + PLAN kanıt referanslarına output/ yolları + JPEG/PNG uzantı düzeltmesi | Yeşilliği makineye bağla | S |

Toplam: **~1 iş günü**. Sonrası: Dilim 2 runtime serbest.

---

## 5. SONRAKİ OTURUM PARALEL YÜRÜTME TASLAĞI (orkestra notu)

- **Ana hat (ben):** K1-K3 güvenlik/parser yamaları → Dilim 2.0 nakli → IR v0.2
  (sync/violations/conflicts alanları §10.6'ya göre) → MapView React Flow.
- **Alt-ajan paketi 1:** K4 doküman birleştirme + Terim Sözlüğü + K6 LICENSE/schemaVersion.
- **Alt-ajan paketi 2:** K7 CI + genişletilmiş fixture seti ([X], CRLF, çok-satırlı
  bold, 11 token'ın tamamı) — parlatma #1-3'ün testleri.
- **Windows kolunuz:** `npm run dev` (:4173) + tarayıcıdan Uyum sekmesi kontrolü;
  gitdiagram tarafında `npx next dev --turbo` ile OPENAI üretim denemesi.
- **Kritik/riskli onay noktaları (yine size):** Dilim 2.0'ın PLAN'a girishi (K5
  kapsamında) ve motor-nakli başlangıç GO'su.

---

## 6. 2026-08-25 DÜZELTME VE BAĞIMSIZ TEYİT EKİ

K1–K7 değişiklikleri uzak repoya gönderilmeden önce yeniden incelendi. İlk
koşumda `phaseFiles.test.ts` içindeki geçersiz `\u201i` kaçışı nedeniyle hem
typecheck hem test kapısı kırmızıydı; “yaklaşık 32 test yeşil” beklentisi teslim
kanıtı sayılmadı.

Kapatılan ek bulgular:

1. Geçersiz test kaçışı düzeltildi; `WAITING_HUMAN` için `I/İ` regresyonu eklendi.
2. Çok satırlı bold başlık birleştirmesi ve faz-kapsamlı bileşik madde kimliği
   nöbetçileri tamamlandı; kullanılmayan `PLAN` tokenı şemadan/sözlükten çıkarıldı.
3. `.env`, `.git`, `.kokpit`, `node_modules` ve `gitdiagram` statik yol engeli ile
   Host doğrulaması saf testlere bağlandı.
4. Registry yazımı kopyala-sil yerine aynı dizinde atomik `rename` kullanır;
   geçici dosya kalmaması test edilir.
5. `PLAN.md` gömülü HTML anlık görüntüsü ve `--st-*` durum belirteçleri otomatik
   senkron/nöbetçi kapısına alındı; CI bu kontrolü typecheck/testten önce koşar.
6. UI-SPEC bağlayıcılığı ile uygulama olgunluğu ayrıldı: Proje Merkezi büyük
   ölçüde bağlı; Harita/Delta örnek; Uyum motoru açıktır.
7. JPEG içeriğini `.png` diye taşıyan ve kişisel yerel yol gösteren ekran
   görüntüleri yayımlanacak Git geçmişinden çıkarıldı. Orijinal yerel commitler
   yalnız geri alınabilir yerel inceleme dalında kaldı.

**Node 20.20.2 kabul sonucu:** `check:preview` yeşil; typecheck exit 0; 6 test
dosyasında **37/37** test geçti. Canlı `:4181` kabulünde UI ve health 200;
`/.env`, `/.env.local`, `/gitdiagram/.env` 404; yabancı Host 403 döndü.

**Uzak CI sınırı:** Dal push'undan sonra GitHub Actions `run 32842069439`
oluştu; ancak iş hiçbir checkout/test adımına başlamadan hesap ödemesi veya
harcama limiti anotasyonuyla durduruldu. Bu bir kod/test hatası değildir, fakat
uzak koşum kanıtı da değildir. Faturalama engeli kalkınca workflow yeniden
çalıştırılmalıdır; o zamana kadar kanonik yürütülmüş kanıt yukarıdaki yerel
Node 20 kapısıdır.
