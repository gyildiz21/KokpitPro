# 02 · Manzara Taraması — Araç Kartları

> **Tarih:** 2026-08-24 · Kaynaklar: GitHub repo sayfaları, resmî dokümantasyon,
> basın/HN/LinkedIn kayıtları (her kartta belirtilir). Tarihler ve sayılar
> erişim anındaki hâldedir.

## Kategori A — AI ile repo → mimari diyagram (en yakın kategori)

### A1 · GitDiagram ⭐ ANA FORK ADAYI
- **Repo:** `ahmedkhaleel2004/gitdiagram` · **MIT** · **15.908 yıldız / 1.230 fork**
- **Stack:** Tek Next.js 16 App Router uygulaması (React 19, TS, Tailwind 4, Bun) — ayrı backend yok
- **Boru hattı:** GitHub tree+README → akışkan açıklama üretimi → **katı şemalı graph AST** (grup/düğüm/kenar/yol; gerçek ağaçla doğrulanır) → **deterministik Mermaid derleyicisi** → tarayıcıda sanitizeli render → artefakt kalıcı saklanır
- **Öne çıkanlar:** tıklanınca gerçek GitHub dosyasına gider · özel repolar için tarayıcı-içi PAT · self-host'ta OpenRouter seçeneği · Mermaid/PNG dışa aktarım
- **Zayıflık:** LLM'in geçersiz Mermaid üretmesi tarihsel sorun (AST-doğrulama katmanı bunu büyük ölçüde iyileştirmiş); faz-planı kavramı YOK
- **Talep kanıtı:** HN ön sayfa (222 puan), lansmanda 25k kullanıcı/24saat, GitHub Trending #1 (30 Mar 2025) — bkz. `04-talep-dogrulamasi.md`

### A2 · DeepWiki (Cognition)
- **Biçim:** Kapalı kaynak **hizmet** (deepwiki.com) — GitHub'daki repo yalnız docs (87 yıldız)
- **Ne yapar:** Herkese açık repolar için ücretsiz wiki: mimari diyagramları, modül sayfaları, satır-seviyesi atıflı sohbet, MCP sunucusu (`mcp.deepwiki.com`); `.devin/wiki.json` ile yönlendirme; 50k+ repo indeksli
- **Kokpit ihtiyacına uymama nedeni:** fork'lanamaz (kapalı); kendi akışına gömülemez; faz/iş takibi yok; veri dışarı çıkar

## Kategori B — Statik analiz + metrik haritalama

| Araç | Lisans | Ne verir | Kokpit açısından |
|---|---|---|---|
| **CodeCharta** (MaibornWolff) | BSD-3, 496★ | 3D şehir haritası, SonarQube/CSV içe aktarma, **iki haritanın deltası**, tamamen yerel, CI entegre | Delta fikri değerli; ama metrik odaklı, faz/plan kavramı yok, 3D öğrenme eğrisi |
| **Emerge** (glato) | MIT, ~1k★ | D3 kuvvet grafiği + Louvain kümeleme, SLOC/fan-out/**git churn** ısı haritaları, tek-HTML çıktı; TS/JS yalnız dosya düzeyi | Görsel desen dersi (kümeleme+ısı); plan bağlantısı yok |
| **Sourcetrail** | arşivlenmiş | Eski altın-standart gezinme | Ölü — ders: masaüstü tek-başına modeli sürdürülemedi |
| **CodeScene** | ticari | Churn/sahiplikten risk sıcak noktaları, teknik borç | Ücretli + davranışsal odak; kod sahipliği modeline uymaz |

## Kategori C — Plan/faz ↔ kod eşleşmesi (2025–26'DA DOĞAN DALGA)

> Bu kategori araştırmanın en önemli bulgusudur: kullanıcının tarif ettiği
> "geliştirme kokpiti" **2025–26'da bağımsız bir ürün kategorisi olarak
> doğmuştur** ve henüz olgunlaşmamıştır.

| Araç | Biçim | Faz/harita bağlantısı | Farklılık |
|---|---|---|---|
| **data-loom** (groscy) | yerel dashboard, tamamen offline | OpenSpec yol haritası **bağımlılık fazı + duruma göre renkli**; "Atlas" = oturmuş sistemin yaşayan Arc42 dokümanı; **son ziyarettten beri değişeni işaretler**; MCP topolojisi | Konsept olarak kullanıcının ihtiyacının ta kendisine en yakın; ama OpenSpec formatına bağlı |
| **dev-harness** (ZihadHosan) | saf Node.js, AI'sız, localhost:4319 canlı reload | `architecture.json` küratörlü bileşen grafiği; sağlık durumları (🟢🟡🔴🔵 wip / **⚪ Suggested: henüz yazılmamış önerilen düğümler!**); post-commit hook ile auto-sync; AGENTS.md/CLAUDE.md üretimi; `verify` doküman-kod tutarlılığı | "Kodlanmadan görme" fikrini EN BASİT biçimde uygulayan; genç/küçük proje |
| **StrayMark Loom** | deneysel, loopback-only dashboard | Bilgi grafiği + **"you are here" mimari haritası**: yönetişim sinyallerinden (aktif charter, drift, borç) canlı durum boyaması (active/in-progress/implemented/has-debt/uncharted); `model.yml`+`plan.drawio` tek-model-çok-görünüm; append-only `sync` | BIM yaklaşımı ("bir model, birçok projeksiyon") + insan/AI ortak rafinasyon döngüsü |
| **CodeAtlas** (ticari) | SaaS/IDE | Beş bağlı katman (sistem→fonksiyon akışı), her katmana **diff-aware overlay** (PR'nin mimari ayak izi), kayıtta kaskad güncelleme; **Plan-from-spec: Linear biletini yapıştır → cluster+dosyalar+testler+scope**; ADR taslağı; yol haritasında mimari planlama yüzeyi | Vizyon olarak en olgunu; kapalı/ticari |
| **ArchSteer** | CLI+CI+cloud | Koddan gerçek mimariyi türetir, deterministik Mermaid C4 yaşamayan dokümanlar üretir; **Drift Index**; CLAUDE.md'e guardrail enjekte ederek ajanları yönlendirir; conformance ratchet | "AI'ın yarattığı karmaşıklığı dizginleme" tezi kullanıcının 6. gereksinimine paralel |

## Kategori D — Destek altyapısı (doğrudan rakip değil, yapı taşı)

| Araç | Rol |
|---|---|
| **Mermaid** (89.7k★) | Diyagram-as-code standardı; GitHub markdown içinde native render — kokpitin çıktı formatı adayı |
| **Structurizr/C4** | Model-as-code mimari dokümantasyon; manuel bakım yükü var; Mermaid export'u var |
| **Repomix** | Repo → tek dosya paketleme (LLM besleme); kokpitin "bağlam ihracı" özelliği için desen |
| **dependency-cruiser / Madge** | JS/TS import grafiği + döngü tespiti, CI-dostu — sıfırdan MVP'de import-grafı motoru adayı |
| **OpenTelemetry servis haritaları** | Çalışma-zamanı izi (v2 aşaması için standart cevap); statik-canlıya ek maliyet/kurulum taşır |
| **Backstage/TechDocs, Swimm** | Kurumsal dev-portalları/doküman-eşleşmesi; ağırlık ve bakım bedeli tek-geliştiriciye göre yüksek; faz↔harita bağlantısı yine de yok |

## Kaynakça (ana)
- github.com/ahmedkhaleel2004/gitdiagram (+CLAUDE.md, docs/dev-setup.md)
- deepwiki.com · cognition.com/blog/deepwiki · docs.devin.ai/work-with-devin/deepwiki
- github.com/glato/emerge · maibornwolff.github.io/codecharta
- gitkraken.com/press/gitkraken-acquires-codesee · linkedin.com/posts/shaneak_… · loot-drop.io/startup/2500-codesee
- github.com/groscy/data-loom · github.com/seanbarlow/doit · straymark.dev/docs/adopters/LOOM · codeatlas.live · archsteer.com · github.com/ZihadHosan/dev-harness
