# AGENTS.md — AI-ajan oturumları için giriş dosyası

Bu depoda çalışan her AI-ajan bu dosyayı okuyarak başlar.

## Otorite sırası

Çelişki hâlinde üstteki kazanır:

1. `UI-SPEC.md`
2. `DESIGN.md`
3. `PLAN.md`

## Kritik kurallar

- **Sahte-kapı yasağı:** Testleri geçmek için sahte/stub implementasyon yazmak yasak.
- **Hex-in-component yasağı:** Bileşen içine hex renk kodu yazılmaz; yalnızca `--st-*` tasarım belirteçleri kullanılır.
- **Kişisel bilgi:** Ad/e-posta gibi kişisel veriler kod ağacına girmez.
- **Nöbetçi test:** Her davranış değişikliği eşlik eden regresyon testiyle gelir.
- **Ölçmeden düzeltme yok:** Önce ölç/profille, sonra optimize et.
- **Defter-kod senkronu:** Kapanan her dilimin `PLAN.md` satırı aynı oturumda güncellenir.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu (tsx watch)
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
```

Commit öncesi kapı: `npm run typecheck && npm run test` yeşil olmalı.

## Node sürümü

Node **20** gerekir (`.nvmrc`). Dikkat: WSL kabuğunda Node yoktur — koşumları (`dev`/`test`/`typecheck`) **Windows terminalinden** çalıştır.
