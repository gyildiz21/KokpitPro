# Railway özel inceleme yayını

Bu çalışma yolu kamuya açık SaaS değil, tek kullanıcılı/özel kabul ortamıdır.
Frontend ve API aynı Node servisi ve aynı origin altında çalışır.

## Zorunlu Railway ayarları

1. Kaynak: `gyildiz21/KokpitPro`, `main` dalı; builder `Dockerfile`.
2. Volume: `/data`; değişken `KOKPIT_DATA_DIR=/data`.
3. Domain üretildikten sonra `KOKPIT_PUBLIC_ORIGIN=https://<domain>`.
4. `KOKPIT_DEPLOYMENT_MODE=cloud`, `HOST=0.0.0.0`.
5. `KOKPIT_ACCESS_USERNAME=kokpit` ve en az 24 rastgele karakterlik
   `KOKPIT_ACCESS_PASSWORD` Railway secret olarak.
6. Özel GitHub repo kabulü gerekiyorsa `GITHUB_APP_ID`,
   `GITHUB_APP_INSTALLATION_ID` ve satır sonları korunmuş
   `GITHUB_APP_PRIVATE_KEY` Railway secret olarak. Anahtar image'a, loga veya
   Git'e yazılmaz.
7. Health path: `/api/health`. Railway health host'u kod allowlist'indedir.

## Canlı kabul

- Kimliksiz `/arayuz-onizleme.html` → `401` ve `WWW-Authenticate: Basic`.
- Kimlikli ürün yüzeyi → `200`.
- `/api/health` → `200`, `mode: cloud`; yerel persistence yolu yok.
- Kimlikli `/PLAN.md` ve `/kokpit/server.ts` → `404`.
- Yerel repo doğrulama/kayıt POST'ları → `403`.
- GitHub bağlantı diyaloğunda yerel repo seçeneği yok.
- Seçili GitHub reposu `Doğrula → İndeksle → Hazır` turunu tamamlar.
- Yeniden deploy sonrasında `/data` üzerindeki proje kaydı korunur.

Bu maddelerin tamamı gerçek staging URL'sinde ölçülmeden PLAN Dilim 6.3
kapatılmaz.
