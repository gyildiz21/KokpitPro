# KokpitPro — Faz-Farkındalı Geliştirme Kokpiti

> Ajan-native repolar için **faz belgesinden okuyan**, kodlanan kısmı ve
> planlanan dilimlerin haritadaki yansımasını tek yüzeyde gösteren geliştirme
> kokpiti. Araştırma ve gerekçe: `MethodLogos_Pro/docs/arastirma/kokpit/`.

## Ne yapacak (v1 hedefi)

1. **Faz-Belge Ayrıştırıcı** — `ROADMAP.md` checkbox'ları, faz dosyası durum
   satırları, GO/kapı kayıtları → yapılandırılmış `PhaseSlice[]` JSON
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

Yerel geliştirmede `GITHUB_TOKEN` sunucu ortam değişkeni de desteklenir. Token
HTML'e, API yanıtına, `localStorage`'a veya proje kayıt dosyasına yazılmaz.

## Durum

- [x] Araştırma paketi (5 rapor)
- [x] Repo iskeleti
- [x] Dilim 1 kodu: parser (roadmap+phaseFiles) + Zod sözleşme + CLI + i18n temeli
      *(koşum Windows terminalinde — bkz. PLAN.md Dilim 1 uyarısı)*
- [x] Dilim 2.1: kalıcı ProjectRecord kayıt defteri, yerel Git doğrulama,
      GitHub Contents/GitHub App adaptörü ve proje-bazlı indeks makbuzları
- [ ] Dilim 0: GitDiagram motorunu yerelde ayağa kaldırma (Windows terminal)
- [ ] Dilim 2: Harita + Durum Boyaması (+ D1 i18n disipliniyle ilk bileşenler)
