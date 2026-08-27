# GitDiagram lite referans hazırlığı

KokpitPro'nun çalışma zamanı bu kaynak ağacına bağlı değildir. Bu yama yalnız
`Dilim 0` kapsamındaki referans motor kabulünü yeniden üretmek için tutulur.

- Yukarı akış deposu: `https://github.com/ahmedkhaleel2004/gitdiagram.git`
- Taban dal/commit: `lite` / `1e1e8e9`
- Yerel doğrulama commiti: `d2bdfc9`
- Yama: `gitdiagram-lite.patch`

Temiz bir GitDiagram checkout'unda:

```powershell
git checkout 1e1e8e9
git apply ..\vendor-patches\gitdiagram-lite.patch
npx --yes --package bun@1.3.11 bun run typecheck
npx --yes --package bun@1.3.11 bun run test src/next-config.test.ts src/server/generate/request-admission.test.ts src/server/storage/cache-key.test.ts src/app/api/generate/stream/route.test.ts
```

Yama ESM Next yapılandırma kökünü, R2 olmadan boş artefakt okumasını ve
Upstash olmadan tek-süreç istek kabulünü bağlar. Üretimde Upstash varsa iptal
kaydı fail-closed kalır. Dağıtık Redis/quota davranışı bu lite yamanın kabul
kapsamı değildir.

Referans deponun tek yazılabilir remote'u üçüncü kişiye ait `upstream` olduğu
için yerel commit oraya gönderilmez. Yeniden üretilebilir kaynak bu KokpitPro
reposundaki yamadır.
