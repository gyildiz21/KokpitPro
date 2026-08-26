# 05 · Senaryolar ve Öneri — Fork mu, Sıfırdan mı, Ürün mü?

> **Tarih:** 2026-08-24 · Girdiler: `01`–`04` raporları. Karar önerisi
> kullanıcı onayına sunulur; bu dosya GO değildir.

## 1. Senaryo A — Fork yolu (hızlı kullanım)

### A1 · GitDiagram'ı fork'la + faz katmanını sen yaz (önerilen ana hat)

**Neden bu motor:** MIT lisans; React 19/Next 16/TS stack'i (kullanıcının
becerisiyle birebir); en kritik parça hazır ve kanıtlanmış: **katı şemalı graph
AST → doğrulama → deterministik Mermaid derleyicisi** (LLM'in bozuk Mermaid
sorununu mühendislikle çözmüşler). 15.9k★ topluluk, üstüne geliştirme yapılacak
sağlam zemin.

**Eklenecek üç modül (kokpitin asıl farkı):**

| Modül | İş | Kaynak desen |
|---|---|---|
| **Faz-Belge Ayrıştırıcı** | `ROADMAP.md` checkbox'ları, `.agents/phases/*.md` durum satırları, GO/kapı kayıtları → yapılandırılmış JSON (`PhaseSlice[]`: id, durum, sahiplik, dokunulan dizinler) | MethodLogos'un kendi defter geleneği = spesifikasyonun kendisi |
| **Durum/Delta Katmanı** | AST düğümlerini dizin eşlemesiyle faz dilimlerine bağla; harita üzerinde renk boyaması (kodlandı/sürüyor/planda); **plan-adımı seçilince etkilenen düğüm/kenar/test ön-görünümü** | dev-harness ⚪Suggested + CodeAtlas diff-overlay desenlerinin plan-yönlü birleşimi |
| **Remap Önerisi** | Import-grafı + dosya boyutu/eşleşmeyen dizin sezgileriyle "bu klasörü ayır/birleştir" öneri listesi | dependency-cruiser kuralları + Loom'un refine döngüsü |

**Bedel tahmini:** motor tanışma ~2-3 gün; Faz-Ayrıştırıcı v0 ~2 gün;
durum/delta v0 ~3-4 gün → **çalışan kişisel kokpit ~1.5–2 hafta**.

**Riskler:** Next16/Bun sürüm takibi; LLM maliyeti (self-host'ta OpenRouter ile
kontrollü; ayrıca AST önbelleği zaten var → sadece faz-katmanı deterministik,
LLM'siz çalışabilir).

### A2 · dev-harness'a katkı/fork (en hızlı deneme)

Saf Node, anahtarsız, localhost dashboard'u ve ⚪Suggested kavramı hazır.
**1-2 günde** kendi reponuza bağlanıp denenebilir. Eksikleri: genç proje,
zengin UI yok, faz-belge sözlüğü yok. **Öneri:** A1'e başlamadan 1 günlük
"duyargalık" pilotu olarak kullanın; beklentinizi kalibre eder.

## 2. Senaryo B — Sıfırdan MVP (bağımsız tasarım)

Eğer fork istenmezse mimari taslak:

```
repo/ + faz-belgeleri/
   │
   ▼
[Toplayıcı]  file-tree · dependency-cruiser import grafi · faz-parser · test envanteri
   │
   ▼
[Kokpit-IR]  tek JSON: nodes{yol,katman,durum} edges tests phases{slices→etki}
   │
   ▼
[Renderer]   Mermaid (statik ihrac) + React Flow (interaktif overlay)
   │
   ▼
[Kokpit UI]  üç sekme: Harita (canlı) · Faz Zaman Çizgisi · Delta Ön-görünümü
             + "Remap Önerileri" paneli
v2 (yol haritası): git-hook tetikleme → OTel izi ile çalışma-zamanı katmanı
```

Stack: Vite+React+TS (tek bağımlılıklar: dependency-cruiser, mermaid,
react-flow). **Tahmin: 2 hafta v1 statik-canlı**, çünkü ağır parsing yok —
MethodLogos tecrübesi gösterdi ki değer parser'da değil *sözleşmede*.

## 3. Senaryo C — Ürünleşme (koşullu kapı)

Kanıt: talep iki katmanda da pozitif (`04` §4); ama alan hızla kalabalıklaşıyor
(CodeAtlas/ArchSteer ticari, data-loom/Loom OSS).

**Ürünleşme kapısı şu koşullarda açılır:**
1. Kişisel kokpit 2+ hafta kendi akışınızda kullanıldı ve "geri dönemezsiniz"
   etkisi oluştu (kendi ihtiyacınız = en dürüst PM).
2. Ajan-native konvansiyonlar (AGENTS.md/.claude/phases) yaygınlaşmaya devam
   ediyor → "faz-dosyasını okuyan kokpit" standartlaşan formata biner.
3. data-loom/dev-harness gibi niş oyuncuların büyümesi ölçülür ve boşluk
   hâlâ dolmamışsa.

Farklılaşma tezi tek cümle: **"Ajan-native repolar için faz-belgesinden
okuyan, delta'yı kodlanmadan gösteren kokpit."** CodeSee dersine karşı:
SaaS değil, açık çekirdek + opsiyonel barındırma.

## 4. Önerilen karar (özet)

| Adım | Ne | Ne zaman |
|---|---|---|
| 1 | dev-harness'ı yerelde 1 günlük dene (duyargalık) | hemen |
| 2 | GitDiagram fork'u + Faz-Ayrıştırıcı v0 | onay sonrası |
| 3 | Durum/Delta katmanı v0 (MethodLogos'a bağla) | 1. hafta sonu |
| 4 | Kullanım kararı → Remap modülü / ürünleşme kapısı değerlendirmesi | 2.-3. hafta |

Bu rapor paketi araştırma fazını kapatır; uygulama ayrı GO ister.
