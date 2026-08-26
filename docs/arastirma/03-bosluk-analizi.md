# 03 · Boşluk Analizi — Gereksinim × Araç Matrisi

> **Tarih:** 2026-08-24 · Puanlama: ✅ tam karşılar · 🟡 kısmen · ❌ yok
> Gereksinimler kullanıcının ACADEMOS tecrübesinden türetilen 6 ölçüttür (R1–R6).

## Gereksinim tanımları

| ID | Gereksinim |
|---|---|
| R1 | **Üçgen görünürlüğü:** kodlanan kısım ↔ defter/kayıt ↔ faz planı tek bakışta |
| R2 | **Canlı diyagram:** sistemin işleyişi/bağlantıları Mermaid-benzeri haritada, commit'te yenilenen |
| R3 | **Delta ön-görünümü:** eklenecek dilimin sisteme yansımasını kodlanmadan görmek (önerilen düğümler, etkilenen modül/test listesi) |
| R4 | **AI karmaşasını temizleme:** AI üretimi yapıyı insana okunur sadeleştirmek, müdahaleyi kolaylaştırmak |
| R5 | **Yeniden haritalandırma önerisi:** reponun nasıl yeniden düzenleneceğini önermek |
| R6 | **Bağımsızlık + hafiflik:** self-host, tek geliştiriciye kurulumu/bedeli düşük, tercihen TR arayüz imkânı |

## Matris

| Araç | R1 üçgen | R2 canlı diyagram | R3 delta ön-görünüm | R4 temiz görünüm | R5 remap önerisi | R6 bağımsız/hafif |
|---|---|---|---|---|---|---|
| GitDiagram | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ MIT, self-host |
| DeepWiki | ❌ | ✅ | ❌ | 🟡 | ❌ | ❌ kapalı hizmet |
| CodeCharta | ❌ | 🟡 (3D metrik) | 🟡 (iki harita deltası — geçmişe bakar) | ❌ | 🟡 (hotspot) | ✅ yerel |
| Emerge | ❌ | 🟡 (tek-HTML) | ❌ | 🟡 | 🟡 (kümeleme) | ✅ |
| data-loom | ✅ (OpenSpec) | 🟡 (atlas) | 🟡 ("değişeni işaretle") | 🟡 | 🟡 (çakışma tespiti) | ✅ tamamen yerel |
| dev-harness | 🟡 (sağlık+wip) | 🟡 (HTML harita) | ✅ (⚪ Suggested düğümler!) | 🟡 | 🟡 (sync ekler/silmez) | ✅ saf Node, anahtarsız |
| StrayMark Loom | ✅ (yönetişim sinyali) | ✅ (drawio+3D, durum boyaması) | 🟡 (unassigned katmanlar) | ✅ (refine döngüsü) | ✅ (append-only sync + drift) | ✅ loopback; ama deneysel, kendi framework'üne bağlı |
| CodeAtlas | ❌ (yol haritasında "planning surface") | ✅ (5 bağlı katman) | ✅ (diff-aware overlay; ancak kodlandıktan sonra) | ✅ | 🟡 (violation raporu) | ❌ ticari |
| ArchSteer | 🟡 (evolution feed) | ✅ (deterministik Mermaid C4) | ❌ | ✅ (anti-slop tezi) | ✅ (drift + steer) | 🟡 CLI yerel, cloud kontrol paneli ayrı |
| Backstage/Swimm | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ ağır |

## Boşluk cümlesi

Hiçbir araç altı gereksinimi birlikte karşılamıyor. Kalan gerçek boşluk
**tek bir birleşimdir**:

> **Faz-belge sözlüğünü (ROADMAP checkbox'ları / faz dosyaları / GO kayıtları)
> doğrudan okuyup haritanın üzerine "durum + delta ön-görünümü" olarak bindiren,
> self-host, hafif bir kokpit.**

Bu birleşimin parçaları bugün ayrı ayrı var ve kanıtlanmış:
- Harita motoru: GitDiagram'ın AST→Mermaid derleyicisi (veya dependency-cruiser)
- Durum boyama: Loom'un yönetişim-overlay deseni / dev-harness sağlık renkleri
- Ön-görünüm: dev-harness'ın ⚪ Suggested düğüm fikrinin faz-adımı ölçeğine genişletilmesi
- Temizlik: ArchSteer'in deterministik üretim + insan-ratifikasyon döngüsü

**Kimse yapmayan spesifik şey:** faz belgesini *girdi* alıp haritada
"bu adım gelince şu düğümler/kenarlar/testler değişecek" diyen bir katman.
Mevcut tüm delta mekanizmaları **geçmişe** bakar (commit diff'i); hiçbiri
**plan dosyasından ileriye** okumuyor.

## Neden kimse yapmadı (hipotez — talep raporuna girdi)

1. Genel pazar "repo → anla" tarafında yoğun (onboarding pain), "plan → repo"
   tarafı niş kaldı; çünkü plan formatları repodan repoya değişiyor.
2. Standartlaşma yeni başlıyor: `AGENTS.md`/`.claude/`/OpenSpec gibi ajan-native
   konvansiyonlar yayıldıkça "faz dosyasını makine-okur kılmak" ilk kez
   ölçeklenebilir hâle geldi. Kokpit fikrinin zamanlaması tam bu yüzden 2026'da.
