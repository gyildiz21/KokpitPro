# 01 · Envanter — gyildiz21 Açık Repo Taraması

> **Tarih:** 2026-08-24 · Araştırma paketi: "Geliştirme Kokpiti" (faz-planı ↔ canlı-harita aracı)
> **Yöntem:** GitHub API (`api.github.com/users/gyildiz21/repos`, kimliksiz) + uzak dal doğrulaması

## 1. Sonuç

`gyildiz21` hesabının **açık (public) reposu yoktur.** API sorgusu HTTP 200 ile
**boş dizi** döndürdü. Uzak adresi bilinen tek repo `MethodLogos_Pro`
(`github.com/gyildiz21/MethodLogos_Pro`) **özel** depodur — API listelemesinde
görünmez.

## 2. Bu sonucun araştırmaya etkisi

| Beklenti | Gerçekleşen | Etki |
|---|---|---|
| Kendi açık repolarından fork/aday taraması | Havuz boş | Fork-yolu tamamen **dış açık kaynak araçlara** kaydı — zaten ana senaryoydu; plan değişmedi |
| Kendi kodundan yeniden kullanılabilir bileşen | Yalnız yerel `MethodLogos_Pro` | Kullanıcı kapsam kararıyla yerel repo değerlendirmesini dışladı; yerel birikim yalnız **tecrübe transferi** olarak kullanılır (faz-belge geleneği, KS nöbetçi testleri, GO/kapı disiplini) |

## 3. Pratik notlar

1. Boşluk kalıcı görünüyor: kullanıcı tüm işini özel depoda yürütüyor. Kokpit
   aracının ilk müşterisi/örnek deposu olacağı düşünülürse, `MethodLogos_Pro`
   ya da kokpitin kendi reposunun **demo olarak açılması** pazarlama açısından
   anlamlı bir seçenektir.
2. Özel repoların taranması ileride istenirse read-only PAT ile ikinci tur
   açılabilir; bu turun kapsamı kullanıcı kararıyla "sadece açık repolar"dır.

## 4. Sonraki adım

Araştırmanın asıl ağırlığı dış açık kaynak araçlardadır → bkz.
`02-manzara.md`. O dosyadaki tablo, bu ürün için taban olabilecek adayları
lisans/stack/aktivite eksenlerinde karteleyer.
