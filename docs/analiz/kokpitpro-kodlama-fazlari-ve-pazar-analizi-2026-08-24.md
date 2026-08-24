# KokpitPro Kodlama Fazları, Kullanılabilirlik ve Pazar Analizi

**Tarih:** 24 Ağustos 2026

**İncelenen sürüm:** `f4fb5ea` (`main`)

**Kapsam:** Yalnız kodlama işleri, kullanılabilir ürün eşiği ve pazar potansiyeli.
Araştırma, tasarım keşfi ve dokümantasyon tek başına teslimat sayılmamıştır.

## 1. Yönetici özeti

KokpitPro bugün yerel kullanımda çalışan bir **erken alfa / güçlü PoC**'dir.
Kalıcı proje kaydı, yerel repo doğrulama, temel GitHub adaptörü, plan ayrıştırma,
proje değiştirme ve karşılaştırma kabuğu vardır. Ancak ürünün ana vaadi olan
“plan maddesi ↔ gerçek kod ↔ test ↔ kanıt” zinciri henüz tamamlanmamıştır.

En önemli sonuçlar:

- Bugünkü sürüm geliştiricinin kendi üç reposunu gözlemlemesi için kullanılabilir;
  üçüncü kişiye güvenilir karar aracı olarak verilecek seviyede değildir.
- Mevcut `PLAN.md` kodlama dilimleri doğru yönü gösterir fakat kanonik proje
  adaptörleri, ürün sertleştirme ve dağıtım fazları eksiktir.
- Bir tam-zamanlı kıdemli geliştirici ve AI desteği varsayımıyla özel beta
  **6–10 hafta**, ilk ücretli pilot **12–18 hafta**, genel kullanıma hazır v1
  **20–28 hafta** aralığındadır.
- Bugünkü ölçülebilir pazar payı **%0**'dır; ürün yayımlanmamış ve aktif kullanıcı
  ölçümü yoktur. Buna karşılık AI destekli geliştirmede doğruluk, güvenlik ve
  kanıt ihtiyacı belirgindir.
- En doğru konumlandırma “yeni proje yönetim aracı” veya “yeni kod asistanı”
  değil; **agent-native plan–kod–test doğrulama kokpiti**dir.

## 2. Repoda bulunan kodlama fazları

| Mevcut dilim | Kodlama içeriği | Güncel gerçek durum | Kapanış için gereken |
|---|---|---|---|
| Dilim 0 | GitDiagram `lite` motoru, model sağlayıcısı, repo → Mermaid yolculuğu | API anahtarı artık mevcut; motor uçtan uca koşulmadı | `lite` dalını çalıştır, gerçek repo üretimi, düğüm → dosya bağlantısı ve hata senaryosu kabulü |
| Dilim 0.1 | Parser fixture ve gerçek-veri kabulü | Tamamlandı | Yanlış-pozitif, çok satırlı başlık ve kimlik kararlılığı regresyonları |
| Dilim 1 | ROADMAP/PLAN parserı, faz dosyası sinyalleri, Zod IR, CLI | Mekanik olarak tamamlandı | Kanonik faz gerçeğini proje türüne göre seçen adaptör katmanı |
| Dilim 2 | Import grafı, AST/dizin eşlemesi, faz durum boyaması | Başlamadı | Gerçek kenarlar, phase→path→test eşlemesi, en az üç kanıtlı durum |
| Dilim 2.1 | Proje Merkezi, yerel/GitHub bağlantısı, kalıcı indeks, karşılaştırma | Büyük ölçüde tamamlandı | Özel repo GitHub App kurulumu ve tam E2E matrisi |
| Dilim 3 | Delta ön-görünümü | Başlamadı | Etkilenen dosya/kenar/test listesi ve tahminsiz boş durum |
| Dilim 4 | Remap önerileri | Başlamadı | Büyük dosya, ortak import ve katman sapması sezgileri; kanıtlı öneri paneli |

## 3. Kullanılabilir v1 için önerilen kodlama planı

Mevcut dilimler korunmalı; aşağıdaki sıra ürün kabulünü görünür sonuçlara bağlar.

### K0 — Referans motor ve sağlayıcı kabulü — 3–5 geliştirici-günü

1. GitDiagram `lite` motorunu yalnız kendi dizininden başlat.
2. `.env` içindeki model anahtarını yalnız sunucu sürecinde tüket; log/API/UI'ya
   sızmadığını nöbetçi testle kanıtla.
3. Gerçek GitHub repo → diyagram → düğüm → dosya yolculuğunu çalıştır.
4. Kota, geçersiz repo, model hatası ve yarım üretim durumlarını görünür kıl.

**Çıkış:** Kullanıcı gerçek bir repodan etkileşimli harita üretebilir.

### K1 — Proje otoritesi ve kanonik faz adaptörleri — 8–12 gün

1. `kokpit.project.json` benzeri sürümlü bir proje manifesti tanımla.
2. KokpitPro için `PLAN.md / Dilim` adaptörü yaz.
3. MethodLogos için `ROADMAP + .agents/phases/phase-0…9` adaptörü yaz.
4. PageBlitz için `DEVIR_TESLIM` canlı cursor + aktif plan adaptörü yaz;
   `historical`, `superseded` ve arşiv kayıtlarını aktif faz sayısından ayır.
5. Her kayda `authority`, `lifecycle`, `sourceLine`, `commit` ve `projectId` ekle.
6. Yanlış faz sayımı ve çapraz-proje veri sızıntısını fixture + tarayıcı E2E ile kilitle.

**Çıkış:** Üç referans repo kendi gerçek faz sözleşmesiyle doğru görünür.

### K2 — Gerçek mimari graf ve kod kanıtı — 15–20 gün

1. `dependency-cruiser` ile TS/JS import kenarlarını çıkar.
2. Dosya/dizin düğümlerini AST sembolleriyle zenginleştir.
3. Plan maddesinin açık `paths/tests/owners` alanlarını grafa bağla.
4. “Tamamlandı” durumunu yalnız plan işaretinden üretme; dosya, test ve commit
   makbuzunu ayrı kanıt katmanları olarak göster.
5. Büyük repo için artımlı indeks, iptal ve bayat-makbuz davranışı ekle.

**Çıkış:** Harita dekoratif klasör listesi değil, gerçek kod ilişkisi olur.

### K3 — GitHub ve proje yaşam döngüsü kabulü — 10–15 gün

1. GitHub App kurulumu, installation seçimi ve `Contents: read` kapsamını tamamla.
2. Özel repo, yetki kaldırma, dal silinmesi, force-push ve rate-limit durumlarını işle.
3. Yerel ve GitHub indekslerini aynı IR sözleşmesinde fakat ayrı kaynak makbuzlarıyla tut.
4. 1440/1024/768 görünüm, klavye, odak dönüşü, yeniden yükleme ve proje izolasyonu
   E2E testlerini CI'da çalıştır.

**Çıkış:** Dış kullanıcı en az bir özel GitHub reposunu güvenle bağlayabilir.

### K4 — Delta ve etki analizi — 10–15 gün

1. Faz maddesi → değişecek yollar → bağımlı düğümler → ilgili testler zincirini üret.
2. Yeni düğüm/kenarları ayrı “öneri” katmanında göster.
3. Kanıt yoksa tahmin üretmek yerine `ölçülemiyor` sonucu ver.
4. İnsan tarafından kabul/red edilen etki önerilerini ölç.

**Çıkış:** Kullanıcı kodlamadan önce değişikliğin olası yüzeyini görebilir.

### K5 — Uyum, remap ve karar bütünlüğü — 15–25 gün

1. Kod değişti/plan güncellenmedi durumunu commit farkıyla yakala.
2. AGENTS/DESIGN kurallarından makinece denetlenebilir kuralları çıkar.
3. Büyük dosya, ortak import, katman ihlali ve döngü önerileri üret.
4. Her uyarıyı kanıt diff'ine ve kaynak kuralına bağla; tek sağlık puanı üretme.

**Çıkış:** Uyum ekranı örnek veri değil, doğrulanabilir iş kuyruğu olur.

### K6 — Ürünleştirme ve dağıtım — 25–40 gün

1. Yerel paket/installer veya güvenli self-host dağıtım biçimini seç.
2. Kullanıcı/organizasyon, rol ve proje erişim sınırlarını ekle.
3. Şifreli sır yönetimi, veri saklama/silme ve audit log sözleşmesini tamamla.
4. Arka plan indeksleme, iş kuyruğu, retry/iptal, performans bütçesi ve hata izleme ekle.
5. İlk-kullanım akışı, örnek repo, tanılama paketi ve destek yüzeyini hazırla.
6. Lisans, kullanım ölçümü ve gerekiyorsa faturalama katmanını ekle.

**Çıkış:** Ürün geliştirici makinesinin dışına güvenle verilebilir.

## 4. Tahmini kullanılabilirlik takvimi

### Varsayımlar

- Bir tam-zamanlı kıdemli geliştirici + AI destekli kodlama.
- İlk v1 yalnız TypeScript/JavaScript ağırlıklı repoları hedefler.
- İlk aşamada üç kanonik adaptör vardır: KokpitPro, MethodLogos, PageBlitz.
- Enterprise SSO, çok bölgeli SaaS ve ağır faturalama ilk pilot kapsamı dışındadır.
- Süreler takvim sözü değil, mevcut kod ve kanıt boşluklarından türetilmiş aralıktır.

| Seviye | Gerekli kapanış | Tahmin | Kullanım sınırı |
|---|---|---:|---|
| İç kullanım / dogfood | Mevcut sürüm + K0 | Şimdi–2 hafta | Sahibi tarafından, bilinen repo biçimleriyle |
| Özel beta | K1–K3 | 6–10 hafta | 5–10 tasarım ortağı, destekli kurulum |
| İlk ücretli pilot | K4–K5 + güvenlik sertleştirmesi | 12–18 hafta | Küçük ekipler, sınırlı repo/dil matrisi |
| Genel kullanıma hazır v1 | K6 + 8 haftalık beta kanıtı | 20–28 hafta | Belgeli kurulum, destek ve ölçümle |

İki güçlü geliştiriciyle paralel yürütme süreyi yaklaşık **14–20 haftaya**
indirebilir; ancak kanonik adaptör ve E2E kabulü paralelleştirilse bile ürün
gerçeğinin tek IR sözleşmesinde birleşmesi gerekir.

## 5. Pazar kanıtı

- GitHub'ın 2025 Octoverse raporu 180 milyondan fazla geliştirici, 630 milyon
  repo ve 4,3 milyon AI projesi bildiriyor. Katkıların %81,5'inin özel
  repolarda olması, özel-repo desteğinin isteğe bağlı değil çekirdek gereksinim
  olduğunu gösterir. Kaynak: [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/).
- Stack Overflow 2025 araştırmasında AI araçlarına kullanım/ilgi yüksek olsa da
  katılımcıların %87'si doğruluk, %81'i güvenlik ve gizlilik konusunda kaygı
  bildiriyor. Agent kullananlarda bireysel verim kazanımı yüksekken ekip
  işbirliğinde olumlu etki yalnız %17 düzeyinde. Bu, Kokpit'in kanıt ve ortak
  bağlam tezini destekler. Kaynak: [Stack Overflow 2025 — AI](https://survey.stackoverflow.co/2025/ai).
- JetBrains'in 24.534 katılımcılı 2025 araştırmasında geliştiricilerin %66'sı
  mevcut ölçümlerin gerçek katkılarını yansıttığına inanmıyor veya emin değil.
  Bu nedenle Kokpit tek bir “sağlık yüzdesi” yerine kanıt türlerini ayrı
  göstermelidir. Kaynak: [JetBrains Developer Ecosystem 2025](https://devecosystem-2025.jetbrains.com/).

## 6. Rekabet ve farklılaşma

| Ürün/kategori | Güçlü olduğu iş | KokpitPro'nun savunulabilir farkı |
|---|---|---|
| GitHub Projects | Issue/PR/roadmap planlama ve esnek görünümler | Markdown faz otoritesi ile kod/test kanıtını çapraz doğrulamaz. [Resmî doküman](https://docs.github.com/en/issues/planning-and-tracking-with-projects) |
| Sourcegraph | Çok-repo kod arama, diff, sembol ve code intelligence | Plan yaşam döngüsü, GO kapısı ve beklenen çıktı doğruluğu ana nesnesi değildir. [Resmî doküman](https://sourcegraph.com/docs/code-search) |
| Atlassian Compass/DX | Bileşen kataloğu, yazılım sağlığı ve ekip metrikleri | Daha hafif, local-first, plan-as-code ve agent-native kabul makbuzu yaklaşımı. [Resmî ürün sayfası](https://www.atlassian.com/software/compass) |
| AI kod asistanları | Kod üretme ve görev yürütme | Kokpit kod üretmez; niyetin gerçekten tamamlanıp tamamlanmadığını kanıtlar. |

Kokpit bu ürünleri tamamen değiştirmeye çalışmamalıdır. GitHub ve kod arama
araçlarıyla entegre olan **doğrulama/orkestrasyon katmanı** olarak konumlanmalıdır.

## 7. Pazar büyüklüğü ve pay senaryosu

“Faz-farkındalı agent geliştirme kokpiti” için yayımlanmış bağımsız kategori
verisi yoktur. Bu nedenle aşağıdaki değerler gelir tahmini değil, açık
varsayımlı kullanıcı tabanı senaryosudur.

### TAM, SAM ve bugünkü pay

- **TAM üst sınırı:** GitHub'ın bildirdiği 180M+ geliştirici. Bu kayıtlı tabandır;
  aktif veya satın almaya hazır kullanıcı sayısı değildir.
- **İlk SAM varsayımı:** GitHub geliştiricilerinin %0,25–%1'i; yani yaklaşık
  **450 bin–1,8 milyon** agent-heavy, çok-repo veya plan-as-code kullanıcısı.
  Bu oran ölçülmüş veri değil, doğrulanması gereken ürün varsayımıdır.
- **Bugünkü pazar payı:** **%0**. Ürün özel repoda, dağıtım ve aktif kullanıcı
  telemetrisi yoktur.

### 36 aylık ulaşılabilir pay senaryoları

| Senaryo | Aylık aktif kullanıcı | 180M GitHub tabanındaki pay | Varsayımsal SAM içindeki pay |
|---|---:|---:|---:|
| Koruyucu | 2.000 | %0,0011 | %0,11–%0,44 |
| Temel | 10.000 | %0,0056 | %0,56–%2,22 |
| Güçlü çekiş | 50.000 | %0,0278 | %2,78–%11,11 |

Temel senaryo dahi otomatik oluşmaz. Ürünün en az beş tasarım ortağında tekrar
eden haftalık kullanım ve ölçülebilir zaman/kanıt kazancı göstermesi gerekir.

## 8. İlk hedef müşteri ve pazara giriş

İlk hedef kitle:

1. AI ajanlarıyla yoğun kod yazan 2–20 kişilik ekipler.
2. Birden fazla repo ve Markdown tabanlı faz/handoff yönetişimi kullanan ekipler.
3. Danışmanlık şirketleri, araştırma yazılımı laboratuvarları ve regülasyon/kanıt
   ihtiyacı yüksek ürün ekipleri.

Önerilen giriş sırası:

1. Local-first ücretsiz geliştirici sürümü.
2. Beş tasarım ortağıyla özel beta.
3. GitHub App tabanlı takım sürümü.
4. Kanıt dışa aktarma, politika ve audit özellikleriyle ücretli ekip planı.

## 9. Ürün-pazar uyumu için kabul metrikleri

Genel lansmandan önce aşağıdaki kapılar aranmalıdır:

- Kanonik faz sınıflandırma hatası: test korpusunda **< %2**.
- Çapraz-proje kanıt sızıntısı: **0**.
- İlk repo bağlama → ilk kanıtlı faz görünümü: **< 10 dakika**.
- Beta ekiplerinde 8. hafta haftalık aktif kalma: **≥ %50**.
- Bağlı proje başına haftalık en az üç kanıt/Delta incelemesi.
- Delta önerilerinde insan kabul oranı: **≥ %80**; bilinmeyen durumlar tahminle
  doldurulmaz.
- En az beş ekipten üçünde ölçülen zaman tasarrufu veya yakalanan plan-kod
  sapması.

## 10. Son karar

KokpitPro'nun ürün tezi güçlü ve güncel bir probleme oturuyor: AI kod üretimini
hızlandırırken ekip düzeyinde doğruluk, ortak bağlam ve kanıt açığı büyüyor.
Ancak bugünkü sürümün pazardaki değeri arayüzden değil, K1–K5 zincirinin
gerçekten kapanmasından doğacaktır.

**GO:** Üç referans repo ile kanonik adaptör + gerçek kod grafı + Delta özel
betasına yatırım yapılabilir.

**NO-GO:** Kanonik faz doğruluğu ve kod/test kanıtı çözülmeden genel amaçlı proje
yönetimi, kurumsal dashboard veya yüksek pazar payı iddiasına geçilmemelidir.
