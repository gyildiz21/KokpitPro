// Deterministik TR/EN açıklama kataloğu — Dilim 5.2 (DESIGN D8.3).
//
// AI kapalıyken bütün kullanıcı yolculuğu bu katalogla çalışır: eksik alan
// veya boş kart üretilmez. Katalog teknik kodu tekrar etmez; sade anlamı
// (summary), kullanıcı etkisini (whyItMatters), ilk güvenli eylemi
// (recommendedActions) ve doğrulama adımını (verificationSteps) verir.
// Bilinmeyen kod için ÇÖKMEZ: jenerik dürüst zarf döner — bu sahte değil,
// dürüst sınırdır (limitations notuyla işaretlenir).

import type {
    ExplanationAction,
    ExplanationEnvelope,
    ExplanationEvidenceRef,
    ExplanationSubjectKind,
    LocalizedText,
} from './schema';

/** Katalog çağrı bağlamı: zarfın kimlik alanlarını ve kanıt referanslarını taşır. */
export interface ExplainContext {
    projectId: string;
    sourceRevision: string;
    subjectId: string;
    evidenceRefs?: ExplanationEvidenceRef[];
}

interface CatalogEntry {
    subjectKind: ExplanationSubjectKind;
    summary: LocalizedText;
    whatItMeans: LocalizedText;
    whyItMatters: LocalizedText;
    recommendedActions: ExplanationAction[];
    verificationSteps: LocalizedText[];
    limitations?: LocalizedText[];
}

/** Uyum kural kodları (UI-SPEC §10.4 başlangıç seti) — sade dilde. */
const RULE_CATALOG: Record<string, CatalogEntry> = {
    'hex-in-component': {
        subjectKind: 'violation',
        summary: { tr: 'Bileşende sabit renk kodu', en: 'Hard-coded color in a component' },
        whatItMeans: {
            tr: 'Bir arayüz bileşeni rengi doğrudan kodun içinde taşıyor; tasarım sisteminin paylaşılan --st-* renk belirtecini kullanmıyor.',
            en: 'A UI component carries a color directly in code instead of using the shared --st-* design token.',
        },
        whyItMatters: {
            tr: 'Sabit renkler temalar arasında kırılır ve aynı rengin çeşitli yerlerde farklı yazılması tasarım tutarsızlığı yaratır.',
            en: 'Hard-coded colors break across themes, and the same color written differently in many places creates design drift.',
        },
        recommendedActions: [
            {
                id: 'verify-token-registry',
                label: { tr: 'Rengi bir --st-* belirtecine taşıyın.', en: 'Move the color to an --st-* token.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunu yeniden çalıştırıp bu kural kaydının listeden düştüğünü görmek.',
                en: 'Re-run compliance and confirm this rule record drops off the list.',
            },
        ],
    },
    'koşumsuz-commit': {
        subjectKind: 'violation',
        summary: { tr: 'Kabul koşulu olmadan tamamlanmış görünen kayıt', en: 'Record closed without an acceptance condition' },
        whatItMeans: {
            tr: 'Bir plan maddesi neyin kanıt sayılacağı belirtilmeden "yapıldı" olarak işaretlenmiş.',
            en: 'A plan item was marked as done without stating what proves it.',
        },
        whyItMatters: {
            tr: 'Koşulsuz tamamlanma doğrulama taşımadığı için plan ile kod arasındaki güveni zayıflatır.',
            en: 'Unconditional completion carries no proof and weakens trust between plan and code.',
        },
        recommendedActions: [
            {
                id: 'open-record',
                label: { tr: 'Kaydı açıp kabul koşulunu ve tarihini ekleyin.', en: 'Open the record and add its acceptance condition and date.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda kaydın artık koşullu göründüğünü görmek.',
                en: 'Re-run compliance and confirm the record now shows its condition.',
            },
        ],
    },
    'hardcode-metin': {
        subjectKind: 'violation',
        summary: { tr: 'Arayüzde sabit yazı', en: 'Hard-coded text in the UI' },
        whatItMeans: {
            tr: 'Kullanıcıya görünen bir yazı doğrudan bileşene yazılmış; çeviri sözlüğünden gelmiyor.',
            en: 'A user-visible string is written directly in the component instead of coming from the dictionary.',
        },
        whyItMatters: {
            tr: 'Sabit yazılar çevrilemez; dil değiştiğinde kullanıcı yarım bir arayüz görür.',
            en: 'Hard-coded strings cannot be translated; a language switch leaves the user with a half-translated UI.',
        },
        recommendedActions: [
            {
                id: 'verify-token-registry',
                label: { tr: 'Yazıyı çeviri sözlüğüne taşıyıp anahtarla kullanın.', en: 'Move the string into the i18n dictionary and reference it by key.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunu yeniden çalıştırıp bu kural kaydının listeden düştüğünü görmek.',
                en: 'Re-run compliance and confirm this rule record drops off the list.',
            },
        ],
    },
    'sahte-kapı': {
        subjectKind: 'violation',
        summary: { tr: 'Sahte kapı: var olmayan yetenek için arayüz', en: 'Fake gate: UI for a missing capability' },
        whatItMeans: {
            tr: 'Bir ekran öğesi, gerçekte bulunmayan bir yeteneği var gibi gösteriyor.',
            en: 'A UI element presents a capability that does not actually exist.',
        },
        whyItMatters: {
            tr: 'Sahte kapı kullanıcıyı yanıltır; güven, düğme göründüğü için değil çalıştığı için kurulur.',
            en: 'A fake gate misleads users; trust is earned by working actions, not visible ones.',
        },
        recommendedActions: [
            {
                id: 'open-record',
                label: { tr: 'Kaydı inceleyip yetenek gerçekleşene kadar yüzeyi kaldırın.', en: 'Review the record and remove the surface until the capability exists.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda sahte kapı kaydının düştüğünü ve yüzeyin artık çizilmediğini görmek.',
                en: 'Re-run compliance, confirm the fake-gate record drops and the surface is gone.',
            },
        ],
    },
    'bayat-kutu': {
        subjectKind: 'violation',
        summary: { tr: 'Yol haritasında bayat kutu', en: 'Stale box on the roadmap' },
        whatItMeans: {
            tr: 'Yol haritasındaki bir tamamlanma kutusu uzun süredir güncellenmemiş; teslim kayıtlarıyla uyuşmayabilir.',
            en: 'A completion box on the roadmap has not been touched for a long time and may disagree with delivery records.',
        },
        whyItMatters: {
            tr: 'Bayat kutu planın gerçeği yansıtmadığını gösterir; kararlar eski bilgiyle alınır.',
            en: 'A stale box means the plan no longer reflects reality; decisions get made on old information.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'Defteri yeniden indeksleyip kutunun güncel durumunu çekin.', en: 'Re-index the ledger to refresh the box state.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda kutunun tazelendiğini veya dürüstçe bayat işaretlendiğini görmek.',
                en: 'Re-run compliance and confirm the box is refreshed or honestly marked stale.',
            },
        ],
    },
    'ks-band-delinmesi': {
        subjectKind: 'violation',
        summary: { tr: 'Sağlık bandı tutarsızlığı', en: 'Health band inconsistency' },
        whatItMeans: {
            tr: 'Rapor listelerindeki sayılar sağlık bantlarıyla uyuşmuyor ya da aynı fazda tamamlanma tarihleri geriye akıyor.',
            en: 'Report list counts disagree with the health bands, or completion dates flow backwards within a phase.',
        },
        whyItMatters: {
            tr: 'İç tutarsızlık, panonun hangi sayısının doğru olduğunu belirsizleştirir; kararlar hatalı banda dayanabilir.',
            en: 'Internal inconsistency makes it unclear which number is right; decisions may rest on the wrong band.',
        },
        recommendedActions: [
            {
                id: 'run-compliance',
                label: { tr: 'Uyum koşumunu baştan çalıştırıp bantların yeniden hesaplanmasını sağlayın.', en: 'Re-run compliance so the bands are recomputed from scratch.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeni koşumda liste sayıları ile bant değerlerinin eşleştiğini görmek.',
                en: 'In the new run, confirm list counts and band values match.',
            },
        ],
    },
};

/** Defter senkronu near-miss kodları — kullanıcı diline çevrilir (UI-SPEC §10.9.3). */
const SYNC_CATALOG: Record<string, CatalogEntry> = {
    'date-gap': {
        subjectKind: 'sync',
        summary: { tr: 'Plan kaydı ile teslim kaydının tarihleri uyuşmuyor', en: 'Plan and delivery record dates disagree' },
        whatItMeans: {
            tr: 'Aynı dilim için plan kaydı ve teslim kaydı farklı zamanlarda güncellenmiş.',
            en: 'For the same slice, the plan record and the delivery record were updated at different times.',
        },
        whyItMatters: {
            tr: 'Tarih farkı hangi kaydın doğru olduğunu gizler; dilimin gerçek durumu belirsiz kalır.',
            en: 'The gap hides which record is right; the true state of the slice stays unclear.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'Defteri yeniden indeksleyip iki kaydı tazeleyin.', en: 'Re-index the ledger to refresh both records.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda bu kaydın artık near-miss olmadığını görmek.',
                en: 'Re-run compliance and confirm the record is no longer a near-miss.',
            },
        ],
    },
    'content-hash-mismatch': {
        subjectKind: 'sync',
        summary: { tr: 'Kayıt içerikleri uyuşmuyor', en: 'Record contents do not match' },
        whatItMeans: {
            tr: 'Plan kaydı ile teslim kaydının içerik özetleri farklı; iki taraf aynı belgenin farklı sürümlerini görüyor.',
            en: 'The plan record and the delivery record hash to different content; the two sides saw different versions.',
        },
        whyItMatters: {
            tr: 'İçerik uyuşmazlığı, teslimin planlanan maddenin gerçek karşılığı olmadığı ihtimalini gösterir.',
            en: 'A content mismatch suggests the delivery may not correspond to the planned item.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'İndeksi tazeleyip içerik özetini yeniden hesaplatın.', en: 'Refresh the index and recompute the content hash.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda içerik özetlerinin eşleştiğini görmek.',
                en: 'Re-run compliance and confirm the content hashes match.',
            },
        ],
    },
    'version-field-missing': {
        subjectKind: 'sync',
        summary: { tr: 'Kayıtta sürüm alanı eksik', en: 'Record is missing its version field' },
        whatItMeans: {
            tr: 'Teslim kaydında sürüm bilgisi yok; kaydın hangi kod durumuna ait olduğu belirlenemiyor.',
            en: 'The delivery record lacks version info, so it cannot be tied to a code state.',
        },
        whyItMatters: {
            tr: 'Sürümsüz kayıt geri izlenemez; uyum iddiası kanıta bağlanamaz.',
            en: 'A record without a version cannot be traced back; compliance claims lose their evidence chain.',
        },
        recommendedActions: [
            {
                id: 'open-record',
                label: { tr: 'Kaydı açıp sürüm alanını tamamlayın.', en: 'Open the record and complete its version field.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda kaydın bir sürümle eşleştiğini görmek.',
                en: 'Re-run compliance and confirm the record matches a version.',
            },
        ],
    },
    'phase-file-missing': {
        subjectKind: 'sync',
        summary: { tr: 'Faz belgesi eksik', en: 'Phase document is missing' },
        whatItMeans: {
            tr: 'Bu dilimin faz belgesi bulunamadı; planın bu bölümü okunamıyor.',
            en: 'The phase document for this slice could not be found; this part of the plan cannot be read.',
        },
        whyItMatters: {
            tr: 'Faz belgesi olmadan maddelerin kabul koşulları denetlenemez.',
            en: 'Without the phase document, acceptance conditions of items cannot be audited.',
        },
        recommendedActions: [
            {
                id: 'map-plan-path',
                label: { tr: 'Plan yolunu doğru faz belgesine bağlayın.', en: 'Map the plan path to the correct phase document.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda faz belgesinin bulunduğunu görmek.',
                en: 'Re-run compliance and confirm the phase document is found.',
            },
        ],
    },
    'slice-commit-missing': {
        subjectKind: 'sync',
        summary: { tr: 'Teslim kaydı bu dilime bağlanmamış', en: 'Delivery record is not tied to this slice' },
        whatItMeans: {
            tr: 'Teslim kaydı var ama hiçbir dilim kimliğine bağlanmamış; aitlik belirsiz.',
            en: 'A delivery record exists but is tied to no slice id; its ownership is unclear.',
        },
        whyItMatters: {
            tr: 'Bağlantısız teslim, dilimin kapanış kanıtı SAYILMAZ; kabul açık kalır.',
            en: 'An unlinked delivery does not count as closing evidence; acceptance stays open.',
        },
        recommendedActions: [
            {
                id: 'map-plan-path',
                label: { tr: 'Teslim kaydını dilim kimliğine bağlayın.', en: 'Link the delivery record to the slice id.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Uyum koşumunda kaydın dilime bağlı göründüğünü görmek.',
                en: 'Re-run compliance and confirm the record is tied to the slice.',
            },
        ],
    },
};

/** Delta ölçüm neden kodları (Delta sözleşmesi) — dürüst sınır dilinde. */
const DELTA_CATALOG: Record<string, CatalogEntry> = {
    'no-mapping': {
        subjectKind: 'delta-item',
        summary: { tr: 'Plan maddesi koda eşlenmemiş', en: 'Plan item is not mapped to code' },
        whatItMeans: {
            tr: 'Bu maddenin hangi dosya ve testlere karşılık geldiği henüz kayıtlı değil.',
            en: 'Which files and tests this item corresponds to is not recorded yet.',
        },
        whyItMatters: {
            tr: 'Eşleme olmadan delta ölçülemez; boşluk temiz kod anlamına GELMEZ.',
            en: 'Without a mapping the delta cannot be measured; the blank does NOT mean clean code.',
        },
        recommendedActions: [
            {
                id: 'map-plan-path',
                label: { tr: 'Maddeye doğrulanabilir yol ve test bağlaması ekleyin.', en: 'Add a verifiable path and test mapping to the item.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Maddenin kanıt türünün makbuz eşlemesine yükseldiğini görmek.',
                en: 'Confirm the evidence kind of the item rises to receipt mapping.',
            },
        ],
    },
    'stale-receipt': {
        subjectKind: 'delta-item',
        summary: { tr: 'Karşılaştırma kaydı bayat', en: 'Comparison receipt is stale' },
        whatItMeans: {
            tr: 'Delta, kodun son halinden önce kalmış bir makbuza karşı hesaplanmaya çalışıldı.',
            en: 'The delta was attempted against a receipt older than the current code.',
        },
        whyItMatters: {
            tr: 'Bayat temel, farkı yanlış gösterir; eski sonuç yeni kod hakkında karar verdirmez.',
            en: 'A stale baseline misrepresents the difference; old results must not drive decisions about new code.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'Yeniden indeksleyip temel makbuzu tazeleyin.', en: 'Re-index to refresh the baseline receipt.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeni temelle delta raporunun tazelendiğini görmek.',
                en: 'Confirm the delta report is refreshed against the new baseline.',
            },
        ],
    },
    'no-local-checkout': {
        subjectKind: 'delta-item',
        summary: { tr: 'Yerel çalışma kopyası bağlı değil', en: 'No local checkout is linked' },
        whatItMeans: {
            tr: 'Bu projenin dosyaları bu makinede bağlı bir çalışma kopyasından okunamadı.',
            en: 'The project files could not be read from a linked local checkout on this machine.',
        },
        whyItMatters: {
            tr: 'Çalışma kopyası olmadan kod ve testler ölçülemez; bu eksik indekslemeyle GİDERİLMEZ.',
            en: 'Without a checkout, code and tests cannot be measured; this is NOT fixed by re-indexing.',
        },
        recommendedActions: [
            {
                id: 'link-local-checkout',
                label: { tr: 'Projeyi yerel çalışma kopyasına bağlayın.', en: 'Link the project to a local checkout.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Bağlantı sonrası delta koşumunun yolları okuduğunu görmek.',
                en: 'After linking, confirm the delta run reads the paths.',
            },
        ],
    },
    'paths-not-measured': {
        subjectKind: 'delta-item',
        summary: { tr: 'Bildirilen yollar ölçülemedi', en: 'Declared paths could not be measured' },
        whatItMeans: {
            tr: 'Maddenin bildirdiği yollar kod grafiğinde eşleşen düğüm bulamadı.',
            en: 'The paths declared by the item found no matching nodes in the code graph.',
        },
        whyItMatters: {
            tr: 'Yollar ölçülmeden etki alanı tahmine dayalı kalır; tahmin kanıt SAYILMAZ.',
            en: 'Until paths are measured, the blast radius stays an estimate; estimates do not count as evidence.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'İndeksi tazeleyip yolları yeniden ölçün.', en: 'Refresh the index and re-measure the paths.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeniden ölçümde yolların düğümlerle eşleştiğini görmek.',
                en: 'In the re-measurement, confirm the paths match graph nodes.',
            },
        ],
    },
    'edges-not-measurable-yet': {
        subjectKind: 'delta-item',
        summary: { tr: 'Bağlantılar henüz ölçülemiyor', en: 'Edges are not measurable yet' },
        whatItMeans: {
            tr: 'Bu görünümde dosyalar arası bağlantı ölçümü henüz sağlanmadı; yollar kısmen görünür.',
            en: 'Edge measurement is not available in this view yet; paths are only partially visible.',
        },
        whyItMatters: {
            tr: 'Kenar bilgisi olmadan etki alanı eksik kalır; bu dürüst bir yetenek sınırıdır.',
            en: 'Without edges the blast radius stays incomplete; this is an honest capability limit.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu sınır için güvenli kullanıcı eylemi yok.', en: 'There is no safe user action for this limit.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Kenar ölçümü desteği geldiğinde aynı maddenin kenarları da raporlamasını kontrol listesine not edin.',
                en: 'Note in the checklist that the same item should report edges once support lands.',
            },
        ],
    },
    'comparison-baseline-unavailable': {
        subjectKind: 'delta-item',
        summary: { tr: 'Karşılaştırma temeli yok', en: 'Comparison baseline is unavailable' },
        whatItMeans: {
            tr: 'Delta eski bir kayıtla karşılaştırılmak istendi ama temel kayıt bulunamadı.',
            en: 'The delta tried to compare against an earlier record, but the baseline could not be found.',
        },
        whyItMatters: {
            tr: 'Temel olmadan "değişti" iddiası ölçülemez; karşılaştırma dürüstçe ertelenir.',
            en: 'Without a baseline the claim of change cannot be measured; comparison is honestly deferred.',
        },
        recommendedActions: [
            {
                id: 'reindex',
                label: { tr: 'Temeli yeniden oluşturmak için indeksi tazeleyin.', en: 'Refresh the index to rebuild a baseline.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeni temelle karşılaştırmanın yapıldığını görmek.',
                en: 'Confirm the comparison runs against the new baseline.',
            },
        ],
    },
    'item-not-found': {
        subjectKind: 'delta-item',
        summary: { tr: 'Plan maddesi bulunamadı', en: 'Plan item not found' },
        whatItMeans: {
            tr: 'Delta hesaplanacak madde, plan kayıtları arasında bulunamadı.',
            en: 'The item to compute a delta for was not found among plan records.',
        },
        whyItMatters: {
            tr: 'Kayıp madde, plan ile rapor arasında kimlik uyuşmazlığı olduğunu gösterir.',
            en: 'A missing item signals an identity mismatch between plan and report.',
        },
        recommendedActions: [
            {
                id: 'map-plan-path',
                label: { tr: 'Madde kimliğini plan kaydıyla eşleştirin.', en: 'Match the item id with its plan record.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Kimlik eşleşince deltanın hesaplandığını görmek.',
                en: 'Once ids match, confirm the delta is computed.',
            },
        ],
    },
};

/** Kapsam ve kırpma nedenleri — ölçüm dürüstlüğünün görünür sınırı. */
const COVERAGE_CATALOG: Record<string, CatalogEntry> = {
    'git-history-unavailable': {
        subjectKind: 'coverage',
        summary: { tr: 'Git geçmişi okunamadı', en: 'Git history could not be read' },
        whatItMeans: {
            tr: 'Değişim yoğunluğu hesabı için gereken geçmiş kayıtlarına erişilemedi.',
            en: 'The history needed for change-intensity context could not be accessed.',
        },
        whyItMatters: {
            tr: 'Geçmiş olmadan bağlam ciddiyeti ölçülmez; ihlaller bağlamsız listelenir.',
            en: 'Without history, context friction is unmeasured; violations are listed without context.',
        },
        recommendedActions: [
            {
                id: 'link-local-checkout',
                label: { tr: 'Çalışma kopyası bağlantısını ve git erişimini denetleyin.', en: 'Check the checkout link and git access.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Sonraki koşumda bağlam ciddiyetinin ölçüldüğünü görmek.',
                en: 'In the next run, confirm context friction is measured.',
            },
        ],
    },
    'git-history-truncated': {
        subjectKind: 'coverage',
        summary: { tr: 'Git geçmişi kırpıldı', en: 'Git history was truncated' },
        whatItMeans: {
            tr: 'Geçmiş, belirlenen sınırda bilinçli olarak durduruldu; daha eski değişimler sayılmadı.',
            en: 'History was deliberately stopped at a set limit; older changes were not counted.',
        },
        whyItMatters: {
            tr: 'Değişim sayıları alt sınırdır; eksik veri temiz gibi DEĞİL, kırpılmış gibi gösterilir.',
            en: 'Change counts are lower bounds; missing data is shown as truncated, not as clean.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu kırpma sınırı kullanıcı eylemiyle kalkmaz.', en: 'This truncation limit is not lifted by user action.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Koşum çıktısında kırpma sınırının raporlandığını görmek.',
                en: 'Confirm the run output reports the truncation limit.',
            },
        ],
    },
    'scan-truncated': {
        subjectKind: 'coverage',
        summary: { tr: 'Tarama kırpıldı', en: 'Scan was truncated' },
        whatItMeans: {
            tr: 'Tarama, kayıt sınırına ulaştığı için erken durduruldu; kalan dosyalar okunmadı.',
            en: 'The scan stopped early at its record limit; remaining files were not read.',
        },
        whyItMatters: {
            tr: 'Kırpılan taramada bulgu sayıları alt sınırdır; listenin sonu kesim noktasıdır.',
            en: 'In a truncated scan counts are lower bounds; the end of the list is the cut point.',
        },
        recommendedActions: [
            {
                id: 'run-compliance',
                label: { tr: 'Kapsamı daraltıp taramanın tamamlanabilmesini sağlayın.', en: 'Narrow the scope so the scan can complete.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeni koşumda kırpma işaretinin düştüğünü görmek.',
                en: 'In the new run, confirm the truncation flag drops.',
            },
        ],
    },
    'report-records-truncated': {
        subjectKind: 'coverage',
        summary: { tr: 'Rapor kayıtları kırpıldı', en: 'Report records were truncated' },
        whatItMeans: {
            tr: 'Rapor, sınır nedeniyle kayıtların yalnız bir bölümünü taşıyor; motorun gördüğü tamamı değil.',
            en: 'The report carries only part of the records due to a limit, not everything the engine saw.',
        },
        whyItMatters: {
            tr: 'Kırpılmış rapor, bulgusuz kısımları sessiz gizler; bu dürüstçe işaretlenir.',
            en: 'A truncated report silently hides the parts without findings; that is flagged honestly here.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu rapor sınırı kullanıcı eylemiyle kalkmaz.', en: 'This report limit is not lifted by user action.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Rapor üstbilgisinde kırpma işaretinin korunduğunu görmek.',
                en: 'Confirm the truncation marker is preserved in the report header.',
            },
        ],
    },
    'large-files-skipped': {
        subjectKind: 'coverage',
        summary: { tr: 'Büyük dosyalar atlandı', en: 'Large files were skipped' },
        whatItMeans: {
            tr: 'Belirlenen boyut sınırını aşan dosyalar taramaya alınmadı.',
            en: 'Files above the size limit were excluded from the scan.',
        },
        whyItMatters: {
            tr: 'Atlanan dosyalarda kural ihlali olabilir; kapsam sayısı bunu dürüstçe taşır.',
            en: 'Skipped files may still hold violations; the coverage counters carry that honestly.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu boyut sınırı kullanıcı eylemiyle kalkmaz.', en: 'This size limit is not lifted by user action.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Kapsam sayaçlarında atlanan dosya sayısının göründüğünü görmek.',
                en: 'Confirm the skipped-file count appears in the coverage counters.',
            },
        ],
    },
    'unreadable-files': {
        subjectKind: 'coverage',
        summary: { tr: 'Okunamayan dosyalar var', en: 'Some files could not be read' },
        whatItMeans: {
            tr: 'İzin veya kodlama nedeniyle bazı dosyalar okunamadı ve tarama dışı bırakıldı.',
            en: 'Some files could not be read due to permissions or encoding and were left out.',
        },
        whyItMatters: {
            tr: 'Okunamayan dosya, denetlenemeyen dosyadır; sayısı raporda saklanmaz.',
            en: 'A file that cannot be read cannot be audited; its count is not hidden.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu sınırlama kullanıcı eylemiyle kalkmaz.', en: 'This limitation is not lifted by user action.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Sayaçta okunamayan dosya sayısının korunduğunu görmek.',
                en: 'Confirm the unreadable-file count is preserved in the counters.',
            },
        ],
    },
    'symlinks-skipped': {
        subjectKind: 'coverage',
        summary: { tr: 'Sembolik bağlantılar atlandı', en: 'Symlinks were skipped' },
        whatItMeans: {
            tr: 'Sembolik bağlantılar döngü ve kök dışı erişim riski nedeniyle taranmadı.',
            en: 'Symlinks were not scanned to avoid cycles and outside-root access.',
        },
        whyItMatters: {
            tr: 'Atlanan bağlantı sayısı, taramanın gerçekte nereye bakmadığını gösterir.',
            en: 'The skipped link count shows where the scan genuinely did not look.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Bu güvenlik sınırı kullanıcı eylemiyle kalkmaz.', en: 'This safety limit is not lifted by user action.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Sayaçta sembolik bağlantı sayısının göründüğünü görmek.',
                en: 'Confirm the symlink count appears in the counters.',
            },
        ],
    },
    'outside-root-rejected': {
        subjectKind: 'coverage',
        summary: { tr: 'Kök dışı yollar reddedildi', en: 'Paths outside the root were rejected' },
        whatItMeans: {
            tr: 'Proje kökünün dışına çıkan yollar güvenlik nedeniyle taramaya alınmadı.',
            en: 'Paths leaving the project root were excluded for safety.',
        },
        whyItMatters: {
            tr: 'Kök dışı yol reddi, ölçümün projeyle sınırlı ve tekrarlanabilir olduğunu garanti eder.',
            en: 'Rejecting outside paths keeps measurement bounded to the project and reproducible.',
        },
        recommendedActions: [
            {
                id: 'map-plan-path',
                label: { tr: 'Plan yolunu proje kökü içine taşıyıp yeniden bağlayın.', en: 'Move the plan path inside the project root and re-map it.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Yeniden bağlama sonrası sayaçta kök dışı yol kalmadığını görmek.',
                en: 'After re-mapping, confirm no outside-root paths remain in the counters.',
            },
        ],
    },
    'root-unreadable': {
        subjectKind: 'coverage',
        summary: { tr: 'Proje kökü okunamadı', en: 'Project root could not be read' },
        whatItMeans: {
            tr: 'Tarama, proje kök dizinine erişemediği için hiç başlayamadı.',
            en: 'The scan could not start because the project root directory was not accessible.',
        },
        whyItMatters: {
            tr: 'Kök okunamadığında hiçbir kural değerlendirilemez; boş sonuç temizlik SAYILMAZ.',
            en: 'When the root is unreadable nothing can be evaluated; an empty result does NOT count as clean.',
        },
        recommendedActions: [
            {
                id: 'link-local-checkout',
                label: { tr: 'Çalışma kopyası bağlantısını ve kök yolunu denetleyin.', en: 'Check the checkout link and the root path.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Sonraki koşumda taramanın dosya okuduğunu görmek.',
                en: 'In the next run, confirm the scan reads files again.',
            },
        ],
    },
};

/** Çelişki durumları — insan doğrulaması sınırı kataloğa işlenmiştir (UI-SPEC §10.9.1). */
const CONFLICT_CATALOG: Record<string, CatalogEntry> = {
    candidate: {
        subjectKind: 'conflict',
        summary: { tr: 'Çelişki adayı: insan onayı bekliyor', en: 'Conflict candidate: awaiting human review' },
        whatItMeans: {
            tr: 'İki otorite kaydı aynı konuda ters yönlü hüküm taşıyor gibi görünüyor; makine yalnız aday üretir, karar vermez.',
            en: 'Two authority records appear to pull in opposite directions on one topic; the machine only proposes a candidate, it does not decide.',
        },
        whyItMatters: {
            tr: 'Onaylanmadan açık çelişki SAYILMAZ; bu sınır uydurma karar üretmeyi engeller.',
            en: 'An unconfirmed candidate does NOT count as an open conflict; this limit prevents invented decisions.',
        },
        recommendedActions: [
            {
                id: 'human-review',
                label: { tr: 'Adayı iki kaynak yan yana inceleyip onaylayın veya reddedin.', en: 'Review the candidate side by side with both sources; confirm or reject it.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'İnsan kararının kayıt altına alındığını ve aday durumunun buna göre değiştiğini görmek.',
                en: 'Confirm the human decision is recorded and the candidate status changed accordingly.',
            },
        ],
        limitations: [
            {
                tr: 'Bu bir insan-inceleme adayıdır; onaylanmadan açık çelişki sayılmaz.',
                en: 'This is a human-review candidate; it does not count as an open conflict before approval.',
            },
        ],
    },
    'superseded-chain': {
        subjectKind: 'conflict',
        summary: { tr: 'Eski otorite yeni karar zinciriyle geçildi', en: 'Older authority superseded by a newer decision chain' },
        whatItMeans: {
            tr: 'Aynı konuda daha yeni bir karar zinciri, eski otoritenin hükmünü geçersiz kılmış.',
            en: 'A newer decision chain on the same topic overrides the older authority.',
        },
        whyItMatters: {
            tr: 'Geçilen kayıt artık bağlayıcı değil; kararlar güncel zincirden okunmalıdır.',
            en: 'The superseded record no longer binds; decisions must read from the current chain.',
        },
        recommendedActions: [
            {
                id: 'open-record',
                label: { tr: 'Geçen zinciri kayıttan doğrulayın.', en: 'Verify the superseding chain from the record.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Zaman görünümünde geçişin doğru sırada göründüğünü görmek.',
                en: 'Confirm the timeline shows the supersession in the right order.',
            },
        ],
    },
    'open-conflict': {
        subjectKind: 'conflict',
        summary: { tr: 'Açık çelişki: iki otorite ters yönlü', en: 'Open conflict: two authorities disagree' },
        whatItMeans: {
            tr: 'İnsan doğrulamasından geçmiş iki otorite kaydı aynı konuda çelişiyor.',
            en: 'Two human-verified authority records conflict on the same topic.',
        },
        whyItMatters: {
            tr: 'Çelişki insan kararıyla kapanana kadar plan kararları bu konuda belirsiz kalır.',
            en: 'Until a human decision closes the conflict, plan decisions stay ambiguous on this topic.',
        },
        recommendedActions: [
            {
                id: 'human-review',
                label: { tr: 'Çelişkiyi çözecek otorite kararını verin ve kaydedin.', en: 'Make and record the authority decision that resolves the conflict.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Çelişkinin kapanış kaydıyla kapandığını görmek.',
                en: 'Confirm the conflict closes with a recorded decision.',
            },
        ],
        limitations: [
            {
                tr: 'Açık çelişki yalnız insan kararıyla kapanır; makine otomatik kapatamaz.',
                en: 'An open conflict is closed only by a human decision; the machine cannot close it automatically.',
            },
        ],
    },
    clean: {
        subjectKind: 'conflict',
        summary: { tr: 'Çelişki bulunmadı', en: 'No conflict found' },
        whatItMeans: {
            tr: 'Bu kayıt için çelişki adayı üretilmedi.',
            en: 'No conflict candidate was produced for this record.',
        },
        whyItMatters: {
            tr: 'Sıfır aday, taramanın suskun kaldığı değil çalıştığı anlamına gelir; sınırlar raporlarda dürüst tutulur.',
            en: 'Zero candidates means the scan ran, not that it stayed silent; limits are reported honestly.',
        },
        recommendedActions: [
            {
                id: 'none',
                label: { tr: 'Eyleme gerek yok.', en: 'No action needed.' },
            },
        ],
        verificationSteps: [
            {
                tr: 'Sonraki koşumda da aday üretilmediğini görmek.',
                en: 'Confirm the next run also produces no candidate.',
            },
        ],
    },
};

/** Bilinmeyen kod için dürüst sınır notu — sahte açıklama üretilmez. */
const UNKNOWN_CODE_LIMITATION: LocalizedText = {
    tr: 'Bu kod için özel açıklama henüz kataloğa eklenmedi.',
    en: 'A dedicated explanation for this code has not been added to the catalog yet.',
};

function envelopeFor(entry: CatalogEntry, ctx: ExplainContext): ExplanationEnvelope {
    return {
        schemaVersion: 1,
        projectId: ctx.projectId,
        sourceRevision: ctx.sourceRevision,
        subjectKind: entry.subjectKind,
        subjectId: ctx.subjectId,
        origin: 'deterministic',
        summary: entry.summary,
        whatItMeans: entry.whatItMeans,
        whyItMatters: entry.whyItMatters,
        recommendedActions: entry.recommendedActions.map((action) => ({ ...action, label: { ...action.label } })),
        verificationSteps: entry.verificationSteps.map((step) => ({ ...step })),
        evidenceRefs: (ctx.evidenceRefs ?? []).map((ref) => ({ ...ref, label: { ...ref.label } })),
        limitations: (entry.limitations ?? []).map((limit) => ({ ...limit })),
        generatedAt: new Date().toISOString(),
    };
}

function unknownCodeEnvelope(subjectKind: ExplanationSubjectKind, ctx: ExplainContext): ExplanationEnvelope {
    return envelopeFor(
        {
            subjectKind,
            summary: { tr: 'Bu kod için özel açıklama henüz hazırlanmadı', en: 'No dedicated explanation is prepared for this code yet' },
            whatItMeans: {
                tr: 'Sistem bu kodu tanıyor ve dürüstçe saklıyor; ancak sade dildeki açıklaması kataloğa henüz eklenmedi.',
                en: 'The system stores this code faithfully, but its plain-language explanation is not in the catalog yet.',
            },
            whyItMatters: {
                tr: 'Açıklama uydurmak yerine sınır gösterilir; kodun kendisi teknik kanıt bölümünde durur.',
                en: 'Instead of inventing an explanation, the limit is stated honestly; the code itself stays in the technical evidence section.',
            },
            recommendedActions: [
                {
                    id: 'open-record',
                    label: { tr: 'Kaydı teknik kanıtıyla birlikte inceleyin.', en: 'Open the record together with its technical evidence.' },
                },
            ],
            verificationSteps: [
                {
                    tr: 'Uyum koşumunu yeniden çalıştırıp kodun sürdüğünü görmek.',
                    en: 'Re-run compliance and confirm the code still appears.',
                },
            ],
            limitations: [UNKNOWN_CODE_LIMITATION],
        },
        ctx,
    );
}

/** Uyum kural kodunu sade TR/EN zarfa çevirir; bilinmeyen kodda çökmez. */
export function explainRuleCode(code: string, ctx: ExplainContext): ExplanationEnvelope {
    const entry = RULE_CATALOG[code];
    return entry ? envelopeFor(entry, ctx) : unknownCodeEnvelope('violation', ctx);
}

/** Senkron near-miss kodunu sade TR/EN zarfa çevirir; bilinmeyen kodda çökmez. */
export function explainSyncReasonCode(code: string, ctx: ExplainContext): ExplanationEnvelope {
    const entry = SYNC_CATALOG[code];
    return entry ? envelopeFor(entry, ctx) : unknownCodeEnvelope('sync', ctx);
}

/** Delta/kapsam neden kodunu sade TR/EN zarfa çevirir; bilinmeyen kodda çökmez. */
export function explainReasonCode(code: string, ctx: ExplainContext): ExplanationEnvelope {
    const entry = DELTA_CATALOG[code] ?? COVERAGE_CATALOG[code];
    return entry ? envelopeFor(entry, ctx) : unknownCodeEnvelope('delta-item', ctx);
}

/** Çelişki durumunu sade TR/EN zarfa çevirir; bilinmeyen durumda çökmez. */
export function explainConflictStatus(status: string, ctx: ExplainContext): ExplanationEnvelope {
    const entry = CONFLICT_CATALOG[status];
    return entry ? envelopeFor(entry, ctx) : unknownCodeEnvelope('conflict', ctx);
}
