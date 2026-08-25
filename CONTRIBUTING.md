# CONTRIBUTING.md

KokpitPro'ya katkı kuralları. Kısa ve net: bu kapılar olmadan birleşme yok.

## Katkı akışı

1. Yeni dal aç: `feat/kokpit-*` (örn. `feat/kokpit-harita-filtresi`), düzeltmeler için `fix/...`, belge için `docs/...`.
2. Değişikliği küçük ve odaklı tut; bir PR = tek amaç.
3. Commit stili: **küçük harf Türkçe konvansiyonel** — `feat:`, `fix:`, `docs:` öneki zorunlu.
   - Örnek: `feat: kokpite dilim filtresi ekle`
4. Göndermeden önce zorunlu kapılar:

   ```bash
   npm run typecheck && npm run test
   ```

   Bu komutlar yeşil değilse **commit yok**. İstisna yok.

## Tasarım uyumu

- Her değişiklik `DESIGN.md` içindeki **D1–D5** kararlarına uymak zorundadır.
  (D1 iki dillilik · D2 UX kalite barı · D3 render kararı · D4 ajan-native bağış · D5 dağıtım yolu)
- Çelişki varsa önce DESIGN.md'de karar güncellenir, sonra kod yazılır.

## Sahte-kapı yasağı

Testleri "geçirmek için" boşaltılmış/sahte implementasyon yasaktır.
Yeşil ışık yalnızca gerçek davranışı ölçen testlerden gelir. Sahte-kapı tespit edilen katkı reddedilir.

## Davranış değişikliği

- Her davranış değişikliği nöbetçi (regresyon) testiyle birlikte gelir.
- Ölçmeden düzeltme yok: önce ölç/izle, sonra kodla.
