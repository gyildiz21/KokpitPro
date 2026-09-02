# KokpitPro — Faz-Farkındalı Geliştirme Kokpiti

> Ajan-native repolar için **faz belgesinden okuyan**, kodlanan kısmı ve
> planlanan dilimlerin haritadaki yansımasını tek yüzeyde gösteren geliştirme
> kokpiti. Araştırma ve gerekçe: `MethodLogos_Pro/docs/arastirma/kokpit/`.

## Ne yapacak (v1 hedefi)

1. **Faz-Belge Ayrıştırıcı** — `ROADMAP.md` checkbox'ları, faz dosyası durum
   satırları, GO/kapı kayıtları → sürümlü `RoadmapScan` + `PhaseFileScan` JSON
2. **Canlı Mimari Haritası** — import-grafı + dosya ağacı → Mermaid/React-Flow;
   düğümler faz durumuna göre boyanır (kodlandı / sürüyor / planda)
3. **Delta Ön-Görünümü** — bir faz adımı seçilince etkilenen düğüm/kenar/test
   listesi **kodlanmadan** görünür
4. **Remap Önerileri** — import grafiği + dizin sezgilerinden yeniden düzenleme
   önerileri

## Düzen

```
KokpitPro/
├── README.md            ← bu dosya
├── PLAN.md              ← uygulama dilimleri ve kabul kriterleri
├── .gitignore
└── gitdiagram/          ← referans motor (MIT, upstream korunur)
```

`gitdiagram/` yalnızca **referans motordur**: AST→Mermaid derleyicisi,
doğrulama katmanı ve UI desenleri oradan öğrenilir/adapt edilir. Kokpit kendi
kök reposunda büyür; upstream güncellemeleri `cd gitdiagram && git pull
upstream main` ile alınır.

## Çalıştırma

Windows terminalinde repo kökünden:

```powershell
npm install
npm run dev
```

Uygulama `http://127.0.0.1:4173/arayuz-onizleme.html` adresinde açılır.
Statik dosya sunucusu kullanmayın; Proje Merkezi `/api/projects` ve kalıcı
kayıt defteri olmadan çalışmaz.

Üretim adayını yerelde doğrulamak için:

```powershell
npm run build
npm run smoke:prod
```

## Özel inceleme yayını

İlk bulut hedefi **Railway üzerinde tek Node servisi**dir; frontend ve backend
ayrı dağıtılmaz. `Dockerfile` üretim image'ını, `railway.json` health/restart
kapısını tanımlar. `/data` volume `KOKPIT_DATA_DIR=/data` olarak bağlanır.

Cloud modu yalnız GitHub repolarını kabul eder. Yerel repo yolları devre dışı,
kaynak dosyaları statik erişime kapalı ve tüm ürün yüzeyi Basic erişim kapısı
arkasındadır. Gerekli değişkenler `.env.example`, işletim sırası
`docs/deployment/railway-staging.md` içindedir. Bu staging, çok-kullanıcılı
SaaS veya yerel checkout ölçümünün buluta taşındığı anlamına gelmez.

## Kalıcı proje bağlantıları

- Proje kayıtları ve son başarılı indeks makbuzları
  `.kokpit/data/projects.json` içinde tutulur; bu dizin Git'e girmez.
- Yerel bağlantı `.git`, etkin dal, commit ve `PLAN.md` / `ROADMAP.md` /
  `DEVIR_TESLIM.md` kaynağını doğrular. Plan yolu seçilen Git kökünün dışına
  çıkamaz.
- GitHub bağlantısı halka açık repolarda anonim salt-okur çalışır. Özel
  repolar için önerilen kurulum GitHub App'tir:

```powershell
$env:GITHUB_APP_ID = "..."
$env:GITHUB_APP_INSTALLATION_ID = "..."
$env:GITHUB_APP_PRIVATE_KEY_PATH = "C:\secure\kokpit-pro.pem"
npm run dev
```

Gerçek özel-repo kabul testi varsayılan pakette ortam-korumalıdır. Yalnız
repo dışında geçici bir kayıt defteriyle ve ayrı bir yerel portla açılır:

```powershell
$githubAppProbeData = Join-Path $env:TEMP "kokpit-github-app-e2e"
$env:KOKPIT_DATA_DIR = $githubAppProbeData
$env:KOKPIT_REAL_GITHUB_APP_PROBE = "1"
$env:KOKPIT_E2E_PORT = "42173"
npm run test:e2e -- --grep "S4 · kimlikli GitHub App pozitif turu" --workers=1
```

Test, özel depoyu UI'da `Doğrula → İndeksle → Hazır` akışından geçirir;
oluşturduğu yönlendirilmiş proje kaydını tur sonunda temizler. App kimlikleri,
installation tokenı ve private key KokpitPro ön yüzüne veya Git ağacına yazılmaz.

Yerel geliştirmede `GITHUB_TOKEN` sunucu ortam değişkeni de desteklenir. Token
HTML'e, API yanıtına, `localStorage`'a veya proje kayıt dosyasına yazılmaz.

## Durum

- [x] Araştırma paketi (5 rapor)
- [x] Repo iskeleti
- [x] Dilim 1 kodu: parser (roadmap+phaseFiles) + Zod sözleşme + CLI + i18n temeli
      *(koşum Windows terminalinde — bkz. PLAN.md Dilim 1 uyarısı)*
- [x] Dilim 2.1: kalıcı ProjectRecord kayıt defteri, yerel Git doğrulama,
      GitHub Contents/GitHub App adaptörü ve proje-bazlı indeks makbuzları
- [x] Dilim 2–4: ölçülmüş mimari harita, Delta ve kanıta dayalı Remap önerileri
- [x] Dilim 5.2 teknik sertlik: açıklanabilir Uyum/Delta ve gerçek-korpus makbuzu
- [x] Dilim 6.3: Railway staging canlı kabulü (2026-09-02)
