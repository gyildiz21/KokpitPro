// Dilim 2 temeli — i18n sözlüğü.
//
// D1 (DESIGN.md): kullanıcıya görünen HER metin buradan gelir; bileşende
// hardcode yasaktır. Anahtar paritesi derleme anında `en: Dict` zorlamasıyla,
// koşum anında parity testiyle çifte kilitli.
//
// JSON/makine alan adları BURADA DEĞİLDİR — onlar İngilizce sabittir.

export type Lang = 'tr' | 'en';

const tr = {
    appTitle: 'KokpitPro',
    legend: 'Lejant',
    itemStatus: {
        done: 'Kodlandı',
        open: 'Planlandı',
        partial: 'Sürüyor',
    },
    statusToken: {
        DOCS_LOCK: 'Doküman kilidi',
        WAITING_HUMAN: 'İnsan adımı bekliyor',
        UYGULANDI: 'Uygulandı',
        KAPANDI: 'Kapandı',
        KAPALI: 'Kapalı',
        LOCKED: 'Kilitli',
        ACIK: 'Açık',
        DUZELTME: 'Düzeltme',
        GO: 'GO bekliyor',
        RUNTIME: 'Çalışır durumda',
        PLAN: 'Plan',
    },
    empty: {
        noData: 'Bu bölüm için veri yok.',
        noPhases: 'Faz belgesi bulunamadı — girdi yolunu denetleyin.',
    },
} as const;

type Dict = typeof tr;

// `satisfies Dict` yerine doğrudan tip ataması: eksik/fazla anahtar derleme hatası verir.
const en: Dict = {
    appTitle: 'KokpitPro',
    legend: 'Legend',
    itemStatus: {
        done: 'Done',
        open: 'Planned',
        partial: 'In progress',
    },
    statusToken: {
        DOCS_LOCK: 'Docs lock',
        WAITING_HUMAN: 'Waiting for human step',
        UYGULANDI: 'Applied',
        KAPANDI: 'Closed out',
        KAPALI: 'Closed',
        LOCKED: 'Locked',
        ACIK: 'Open',
        DUZELTME: 'Fix-up',
        GO: 'Awaiting GO',
        RUNTIME: 'Running',
        PLAN: 'Plan',
    },
    empty: {
        noData: 'No data for this section.',
        noPhases: 'No phase document found — check the input path.',
    },
};

export const LABELS: Record<Lang, Dict> = { tr, en };

/** Basit çeviri erişimi: t('tr', 'itemStatus.done') yerine tipli nesne erişimi önerilir. */
export function dict(lang: Lang): Dict {
    return LABELS[lang];
}
