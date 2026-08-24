# Kokpit-IR fixture — MethodLogos_Pro/ROADMAP.md gerçek kesiti (kırpılmış)
# Bu dosya DEĞİŞTİRİLMEZ; nöbetçi testler bu girdiyle sözleşmeyi kilitler.

## 6. Fazlar

### P0 — Temel Onarım ve Güven (1-2 hafta) 🔴

- [x] **#1 Konsensüs körlüğünü gider:** `analyzeConsensus`'a makale başına sınıflandırma
      geçir; sayımlar koddan deterministik hesaplanır. (`literature.ts`, `ai.ts`) — **Tamamlandı 2026-07-17**;
      bonus: normalize edildi.
- [x] **Gerçek embedding:** `vector.ts`'i değiştir. — **Tamamlandı 2026-07-17**
- [ ] **Kartopu (snowballing):** OpenAlex `referenced_works` / `cited_by` ile ileri-geri takip.

### P1 — Kanıt Altyapısı / Veri Katmanı (2-4 hafta) 🔴

- [~] **Sorgu boru hattı:** LLM ile soru anlama → yeniden sıralama.
      — **Dilim 3 (2026-07-18):** `expandQuery` yazıldı.
- [~] **Korpus operasyonları:** filtrele ✅ (yıl, tasarım),
      Sabitle / Hariç tut ✅ — **tamamlandı 2026-07-22**
- [ ] Filtrelerin gerçek olması: yıl aralığı, çalışma türü.
