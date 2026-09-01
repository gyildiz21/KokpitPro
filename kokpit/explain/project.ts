// Ölçüm sözleşmelerinden açıklama projection'ları — Dilim 5.2 (DESIGN D8.1).
//
// Bu modül saftır: I/O yok, model çağrısı yok. Girdi olarak aldığı
// ComplianceReport v1 ve DeltaResult v1 nesnelerini ASLA değiştirmez;
// yalnız okur ve yeni ExplanationEnvelope üretir. Açıklama katmanı hiçbir
// ölçülmüş kaydı ekleyemez, çıkaramaz, ciddiyetini veya durumunu
// değiştiremez (UI-SPEC §10.9.2).

import type { ComplianceReport, ConflictEntry, SyncEntry, SyncStatus, Violation } from '../check/schema';
import type { DeltaResult } from '../delta/schema';
import { explainConflictStatus, explainReasonCode, explainRuleCode, explainSyncReasonCode } from './catalog';
import type {
    ExplanationAction,
    ExplanationEnvelope,
    ExplanationEvidenceRef,
    ExplanationSubjectKind,
    LocalizedText,
} from './schema';

/** Katalog zarfından alınan metin blokları — projection'larda yeniden birleştirilir. */
interface CatalogTexts {
    summary: LocalizedText;
    whatItMeans: LocalizedText;
    whyItMatters: LocalizedText;
    actions: ExplanationAction[];
    verification: LocalizedText[];
    limitations: LocalizedText[];
}

function textsOf(envelope: ExplanationEnvelope): CatalogTexts {
    return {
        summary: envelope.summary,
        whatItMeans: envelope.whatItMeans,
        whyItMatters: envelope.whyItMatters,
        actions: envelope.recommendedActions,
        verification: envelope.verificationSteps,
        limitations: envelope.limitations,
    };
}

/**
 * Sınır (max 8) doluysa en eski limitation düşürülür; yeni dürüstlük notu
 * daima korunur — şema sınırı bunu zorunlu kılar.
 */
function appendLimitation(list: LocalizedText[], item: LocalizedText): LocalizedText[] {
    return list.length >= 8 ? [...list.slice(list.length - 7), item] : [...list, item];
}

function dedupeActions(actions: ExplanationAction[]): ExplanationAction[] {
    const seen = new Set<string>();
    const out: ExplanationAction[] = [];
    for (const action of actions) {
        if (!seen.has(action.id)) {
            seen.add(action.id);
            out.push(action);
        }
    }
    return out;
}

function dedupeTexts(texts: LocalizedText[]): LocalizedText[] {
    const seen = new Set<string>();
    const out: LocalizedText[] = [];
    for (const text of texts) {
        if (!seen.has(text.tr)) {
            seen.add(text.tr);
            out.push(text);
        }
    }
    return out;
}

interface EnvelopeParams {
    projectId: string;
    sourceRevision: string;
    subjectKind: ExplanationSubjectKind;
    subjectId: string;
    texts: CatalogTexts;
    evidenceRefs: ExplanationEvidenceRef[];
    limitations?: LocalizedText[];
}

function baseEnvelope(params: EnvelopeParams): ExplanationEnvelope {
    return {
        schemaVersion: 1,
        projectId: params.projectId,
        sourceRevision: params.sourceRevision,
        subjectKind: params.subjectKind,
        subjectId: params.subjectId,
        origin: 'deterministic',
        summary: params.texts.summary,
        whatItMeans: params.texts.whatItMeans,
        whyItMatters: params.texts.whyItMatters,
        recommendedActions: params.texts.actions,
        verificationSteps: params.texts.verification,
        evidenceRefs: params.evidenceRefs,
        limitations: (params.limitations ?? params.texts.limitations).slice(0, 8),
        generatedAt: new Date().toISOString(),
    };
}

/**
 * İhlal zarfı: summary kuralın sade adıdır; teknik kanıt (dosya:satır, kural
 * referansı, kural kodu, kaynak revizyonu) açılır ikincil bölüm için ayrıdır.
 */
export function buildViolationEnvelope(report: ComplianceReport, violation: Violation): ExplanationEnvelope {
    const texts = textsOf(
        explainRuleCode(violation.rule, {
            projectId: report.projectId,
            sourceRevision: report.sourceRevision,
            subjectId: violation.id,
        }),
    );
    const evidenceRefs: ExplanationEvidenceRef[] = [
        {
            label: { tr: 'Hedef dosya', en: 'Target file' },
            value: violation.targetLine === undefined ? violation.targetPath : `${violation.targetPath}:${violation.targetLine}`,
        },
        { label: { tr: 'Kural referansı', en: 'Rule reference' }, value: violation.ruleReference },
        { label: { tr: 'Kural kodu', en: 'Rule code' }, value: violation.rule },
        { label: { tr: 'Kaynak revizyonu', en: 'Source revision' }, value: report.sourceRevision },
    ];
    const limitations = [...texts.limitations];
    if (violation.contextFriction === 'unmeasured') {
        limitations.push({ tr: 'Bağlam ciddiyeti ölçülmedi.', en: 'Context friction was not measured.' });
    }
    return baseEnvelope({
        projectId: report.projectId,
        sourceRevision: report.sourceRevision,
        subjectKind: 'violation',
        subjectId: violation.id,
        texts,
        evidenceRefs,
        limitations: limitations.slice(0, 8),
    });
}

const SYNC_STATUS_TR: Record<SyncStatus, string> = { current: 'güncel', stale: 'eski', missing: 'eksik', partial: 'kısmi' };
const SYNC_STATUS_EN: Record<SyncStatus, string> = { current: 'current', stale: 'stale', missing: 'missing', partial: 'partial' };

function syncStatusRefs(entry: SyncEntry): ExplanationEvidenceRef[] {
    return [
        { label: { tr: 'Dilim kimliği', en: 'Slice id' }, value: entry.sliceId },
        { label: { tr: 'Faz belgesi durumu', en: 'Phase file status' }, value: entry.phaseFile },
        { label: { tr: 'Yol haritası kutusu durumu', en: 'Roadmap box status' }, value: entry.roadmapBox },
        { label: { tr: 'Teslim kaydı durumu', en: 'Handoff status' }, value: entry.handoff },
    ];
}

/**
 * Senkron zarfı: near-miss varsa katalogdan; yoksa üç kaydın (faz belgesi,
 * yol haritası kutusu, teslim kaydı) dürüst durum özeti. Kodlar ilk katmanda
 * gösterilmez; kullanıcı diline çevrilir (UI-SPEC §10.9.3.4).
 */
export function buildSyncEnvelope(report: ComplianceReport, entry: SyncEntry): ExplanationEnvelope {
    const evidenceRefs = syncStatusRefs(entry);
    if (entry.nearMiss) {
        return explainSyncReasonCode(entry.nearMiss.reasonCode, {
            projectId: report.projectId,
            sourceRevision: report.sourceRevision,
            subjectId: entry.sliceId,
            evidenceRefs,
        });
    }
    const mismatches: { tr: string; en: string }[] = [];
    if (entry.phaseFile !== 'current') {
        mismatches.push({
            tr: `faz belgesi ${SYNC_STATUS_TR[entry.phaseFile]}`,
            en: `phase file ${SYNC_STATUS_EN[entry.phaseFile]}`,
        });
    }
    if (entry.roadmapBox !== 'current') {
        mismatches.push({
            tr: `yol haritası kutusu ${SYNC_STATUS_TR[entry.roadmapBox]}`,
            en: `roadmap box ${SYNC_STATUS_EN[entry.roadmapBox]}`,
        });
    }
    if (entry.handoff !== 'current') {
        mismatches.push({
            tr: `teslim kaydı ${SYNC_STATUS_TR[entry.handoff]}`,
            en: `handoff ${SYNC_STATUS_EN[entry.handoff]}`,
        });
    }
    const allCurrent = mismatches.length === 0;
    return baseEnvelope({
        projectId: report.projectId,
        sourceRevision: report.sourceRevision,
        subjectKind: 'sync',
        subjectId: entry.sliceId,
        texts: {
            summary: allCurrent
                ? { tr: 'Plan kayıtları güncel', en: 'Plan records are current' }
                : { tr: `Defter senkronu uyuşmuyor: ${mismatches.map((part) => part.tr).join(', ')}`, en: `Ledger sync mismatch: ${mismatches.map((part) => part.en).join(', ')}` },
            whatItMeans: {
                tr: 'Her plan maddesinin faz belgesi, yol haritası kutusu ve teslim kaydı aynı kaynak revizyonunda uyuşmalıdır; bu kayıt üçünün karşılaştırmasıdır.',
                en: 'Each plan item requires its phase document, roadmap box and delivery record to agree on the same source revision; this record compares all three.',
            },
            whyItMatters: {
                tr: 'Senkron bozuksa panodaki durum gerçek durumu yansıtmayabilir; near-miss kayıtlar gizli risk taşır.',
                en: 'A broken sync means the board may not reflect reality; near-miss records carry hidden risk.',
            },
            actions: allCurrent
                ? [{ id: 'none', label: { tr: 'Eyleme gerek yok.', en: 'No action needed.' } }]
                : [{ id: 'run-compliance', label: { tr: 'Uyum koşumunu yeniden çalıştırın.', en: 'Re-run the compliance run.' } }],
            verification: [
                allCurrent
                    ? { tr: 'Sonraki uyum koşumunda kaydın güncel kaldığını görmek.', en: 'Confirm in the next compliance run that the record stays current.' }
                    : { tr: 'Uyum koşumunu yeniden çalıştırıp üç kaydın da güncel göründüğünü görmek.', en: 'Re-run compliance and confirm all three records look current.' },
            ],
            limitations: [],
        },
        evidenceRefs,
    });
}

/**
 * Çelişki zarfı: insan doğrulaması sınırı limitations'ta dürüstçe durur;
 * aday onaylanmadan açık çelişki sayılmaz (UI-SPEC §10.9.1.6).
 */
export function buildConflictEnvelope(report: ComplianceReport, conflict: ConflictEntry): ExplanationEnvelope {
    const evidenceRefs: ExplanationEvidenceRef[] = [
        { label: { tr: 'Otorite A', en: 'Authority A' }, value: conflict.authorityA },
        { label: { tr: 'Otorite B', en: 'Authority B' }, value: conflict.authorityB },
        { label: { tr: 'A gözlem tarihi', en: 'A observed on' }, value: conflict.observedAtA },
        { label: { tr: 'B gözlem tarihi', en: 'B observed on' }, value: conflict.observedAtB },
    ];
    return explainConflictStatus(conflict.status, {
        projectId: report.projectId,
        sourceRevision: report.sourceRevision,
        subjectId: conflict.id,
        evidenceRefs,
    });
}

/**
 * Delta zarfı: measured→özet; declared-only→bildirim düzeyi notu;
 * unmeasurable→neden kodlarından katalog açıklamaları + her neden için
 * önerilen eylem; reasons boşsa jenerik dürüst zarf (boş beyaz alan yok).
 */
export function buildDeltaEnvelope(
    delta: DeltaResult,
    context: { projectId: string; sourceRevision: string },
): ExplanationEnvelope {
    const ctx = { projectId: context.projectId, sourceRevision: context.sourceRevision, subjectId: delta.itemId };
    const evidenceKindRef: ExplanationEvidenceRef = {
        label: { tr: 'Kanıt türü', en: 'Evidence kind' },
        value: delta.evidenceKind,
    };

    if (delta.mode === 'measured') {
        const pathCount = delta.affectedPaths.length;
        const edgeCount = delta.addedEdges.length + delta.removedEdges.length;
        return baseEnvelope({
            projectId: ctx.projectId,
            sourceRevision: ctx.sourceRevision,
            subjectKind: 'delta-item',
            subjectId: ctx.subjectId,
            texts: {
                summary: {
                    tr: `Delta ölçüldü: ${pathCount} yol${edgeCount > 0 ? `, ${edgeCount} kenar` : ''} etkilendi`,
                    en: `Delta measured: ${pathCount} path(s)${edgeCount > 0 ? `, ${edgeCount} edge(s)` : ''} affected`,
                },
                whatItMeans: {
                    tr: 'Maddenin bildirdiği yollar, makbuz eşlemesiyle kod grafiğindeki düğüm ve kenarlara bağlandı.',
                    en: 'The paths declared by the item were tied to graph nodes and edges via receipt mapping.',
                },
                whyItMatters: {
                    tr: 'Ölçülmüş delta, plan maddesinin kodda gerçek karşılığı olduğunu kanıtlar.',
                    en: 'A measured delta proves the plan item has a real counterpart in code.',
                },
                actions: [
                    {
                        id: 'select-item',
                        label: { tr: 'Maddeyi haritada seçip etkilenen düğümleri inceleyin.', en: 'Select the item on the map to inspect affected nodes.' },
                    },
                ],
                verification: [
                    {
                        tr: 'Haritada maddenin etkilenen düğüm ve kenarlarla işaretlendiğini görmek.',
                        en: 'Confirm the map marks the item with the affected nodes and edges.',
                    },
                ],
                limitations:
                    delta.evidenceKind === 'receipt-mapping'
                        ? []
                        : [
                              {
                                  tr: 'Kanıt makbuz eşlemesi düzeyinde değil; delta yalnız bildirilen metne dayanır.',
                                  en: 'Evidence is below receipt mapping; the delta rests on declared text only.',
                              },
                          ],
            },
            evidenceRefs: [
                evidenceKindRef,
                {
                    label: { tr: 'Temel revizyon', en: 'Base revision' },
                    value: `${delta.baseRevision.kind}:${delta.baseRevision.revision}`,
                },
                { label: { tr: 'Temel commit', en: 'Base commit' }, value: delta.baseRevision.commit },
            ],
        });
    }

    if (delta.mode === 'declared-only') {
        return baseEnvelope({
            projectId: ctx.projectId,
            sourceRevision: ctx.sourceRevision,
            subjectKind: 'delta-item',
            subjectId: ctx.subjectId,
            texts: {
                summary: { tr: 'Delta yalnız bildirildi: ölçüm yapılmadı', en: 'Delta declared only: not measured' },
                whatItMeans: {
                    tr: 'Madde yollarını bildirdi ancak makbuz eşlemesiyle ölçüm yapılmadı.',
                    en: 'The item declared paths, but no measurement was made through receipt mapping.',
                },
                whyItMatters: {
                    tr: 'Bildirim ölçülmüş etki alanı değildir; bu ayrım dürüstçe korunur.',
                    en: 'A declaration is not a measured blast radius; the distinction is kept honestly.',
                },
                actions: [
                    {
                        id: 'map-plan-path',
                        label: { tr: 'Maddenin kanıt türünü makbuz eşlemesine yükseltin.', en: 'Raise the evidence kind of the item to receipt mapping.' },
                    },
                ],
                verification: [
                    {
                        tr: 'Maddenin kanıt türünün makbuz eşlemesine yükseldiğini görmek.',
                        en: 'Confirm the evidence kind of the item rises to receipt mapping.',
                    },
                ],
                limitations: [
                    { tr: 'Bu delta ölçülmedi; yalnız bildirim düzeyindedir.', en: 'This delta was not measured; it stays at declaration level.' },
                ],
            },
            evidenceRefs: [evidenceKindRef],
        });
    }

    // mode === 'unmeasurable': her neden katalogdan açıklanır; eylemler birleşir.
    const reasonTexts = delta.reasons.map((reason) => textsOf(explainReasonCode(reason.code, ctx)));
    const primary = reasonTexts[0];
    const actions = dedupeActions(reasonTexts.flatMap((texts) => texts.actions)).slice(0, 8);
    const verification = dedupeTexts(reasonTexts.flatMap((texts) => texts.verification)).slice(0, 8);

    let evidenceRefs: ExplanationEvidenceRef[] = delta.reasons.slice(0, 6).flatMap((reason) => [
        { label: { tr: 'Neden kodu', en: 'Reason code' }, value: reason.code },
        { label: { tr: 'Teknik mesaj', en: 'Technical message' }, value: reason.message },
    ]);
    let limitations = reasonTexts.flatMap((texts) => texts.limitations).slice(0, 7);
    if (delta.reasons.length > 6) {
        evidenceRefs = evidenceRefs.slice(0, 12);
        limitations = appendLimitation(limitations, {
            tr: 'Neden sayısı kanıt sınırını aştı; tam liste koşum çıktısındadır.',
            en: 'The reason list exceeds the evidence cap; the full list stays in the run output.',
        });
    } else if (delta.reasons.length > 1) {
        limitations = appendLimitation(limitations, {
            tr: `${delta.reasons.length} farklı neden ölçümü engelledi; tümü teknik kanıtta listelenir.`,
            en: `${delta.reasons.length} distinct reasons blocked measurement; all are listed in technical evidence.`,
        });
    }

    return baseEnvelope({
        projectId: ctx.projectId,
        sourceRevision: ctx.sourceRevision,
        subjectKind: 'delta-item',
        subjectId: ctx.subjectId,
        texts: {
            summary: primary
                ? { tr: `Delta ölçülemedi: ${primary.summary.tr}`, en: `Delta could not be measured: ${primary.summary.en}` }
                : { tr: 'Delta ölçülemedi', en: 'Delta could not be measured' },
            whatItMeans:
                primary?.whatItMeans ??
                {
                    tr: 'Ölçüm neden üretilmedi; bu boşluk dürüstçe işaretlenir.',
                    en: 'No measurement reason was produced; this gap is flagged honestly.',
                },
            whyItMatters:
                primary?.whyItMatters ??
                {
                    tr: 'Ölçülemeyen delta boş beyaz alan değildir; neden ve güvenli eylem birlikte gösterilir.',
                    en: 'An unmeasurable delta is not a blank page; reason and safe action are shown together.',
                },
            actions:
                actions.length > 0
                    ? actions
                    : [{ id: 'none', label: { tr: 'Bu durum için güvenli kullanıcı eylemi yok.', en: 'There is no safe user action for this state.' } }],
            verification:
                verification.length > 0
                    ? verification
                    : [
                          {
                              tr: 'Neden giderildikten sonra deltanın ölçüldüğünü görmek.',
                              en: 'After the reason is fixed, confirm the delta becomes measured.',
                          },
                      ],
            limitations:
                limitations.length > 0
                    ? limitations
                    : [
                          {
                              tr: 'Delta ölçülemedi ancak neden kodu üretilmedi; bu bir boşluk olarak gösterilir.',
                              en: 'The delta could not be measured but no reason code was produced; this is shown as a gap.',
                          },
                      ],
        },
        evidenceRefs,
    });
}

/** Zaman görünümü faz zarfı için bağlam (DESIGN D8.6: "kabul açık" ≠ "motor yapılmadı"). */
export interface SliceEnvelopeContext {
    projectId: string;
    sourceRevision: string;
    phaseId: string;
    heading: string;
    counts: { done: number; partial: number; open: number; blocked: number };
    acceptanceText?: LocalizedText;
    openExternalLimits?: LocalizedText[];
}

/** Faz zarfı: amaç = başlık, durum = sayaç özeti, kabul = kabul metni veya dürüst yok notu. */
export function buildSliceEnvelope(context: SliceEnvelopeContext): ExplanationEnvelope {
    const { counts } = context;
    let limitations: LocalizedText[] = [...(context.openExternalLimits ?? [])];
    if (counts.blocked > 0) {
        limitations = appendLimitation(limitations, {
            tr: `${counts.blocked} madde engelli; engeller kalkmadan faz kabulü kapanmaz.`,
            en: `${counts.blocked} item(s) are blocked; phase acceptance cannot close until the blocks clear.`,
        });
    }
    if (counts.open > 0) {
        limitations = appendLimitation(limitations, {
            tr: `${counts.open} açık madde var; fazın kabul kapısı henüz kapanmadı.`,
            en: `${counts.open} item(s) remain open; the phase acceptance gate is not closed yet.`,
        });
    }
    return {
        schemaVersion: 1,
        projectId: context.projectId,
        sourceRevision: context.sourceRevision,
        subjectKind: 'plan-slice',
        subjectId: context.phaseId,
        origin: 'deterministic',
        summary: { tr: context.heading, en: context.heading },
        whatItMeans: {
            tr: `Durum: ${counts.done} tamamlandı, ${counts.partial} sürüyor, ${counts.open} açık, ${counts.blocked} engelli.`,
            en: `Status: ${counts.done} done, ${counts.partial} partial, ${counts.open} open, ${counts.blocked} blocked.`,
        },
        whyItMatters: {
            tr: 'Faz ilerlemesi, planın hangi bölümünün çalışır kodla desteklendiğini gösterir; "kabul açık" ile "teknik motor yapılmadı" farklı şeylerdir.',
            en: 'Phase progress shows which part of the plan is backed by working code; "acceptance open" and "engine not built" are different things.',
        },
        recommendedActions: [
            {
                id: 'select-item',
                label: { tr: 'Fazı zaman görünümünde seçip maddelerini inceleyin.', en: 'Select the phase in the timeline to inspect its items.' },
            },
        ],
        verificationSteps: [
            context.acceptanceText ?? { tr: 'Bu faz için ayrı kabul metni yok.', en: 'There is no separate acceptance text for this phase.' },
        ],
        evidenceRefs: [
            { label: { tr: 'Tamamlanan madde', en: 'Done items' }, value: String(counts.done) },
            { label: { tr: 'Süren madde', en: 'Partial items' }, value: String(counts.partial) },
            { label: { tr: 'Açık madde', en: 'Open items' }, value: String(counts.open) },
            { label: { tr: 'Engelli madde', en: 'Blocked items' }, value: String(counts.blocked) },
        ],
        limitations: limitations.slice(0, 8),
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Kapsam zarfı: measurement partial/unmeasured ise nedenler katalogdan
 * açıklanır; kapsam sayaçları teknik kanıt olarak dürüstçe listelenir.
 */
export function buildCoverageEnvelope(report: ComplianceReport): ExplanationEnvelope {
    const reasonTexts =
        report.measurement === 'measured'
            ? []
            : report.reasons.map((reason) => textsOf(explainReasonCode(reason.code, { projectId: report.projectId, sourceRevision: report.sourceRevision, subjectId: 'coverage' })));
    const primary = reasonTexts[0];

    const counterCodes: string[] = [];
    if (report.coverage.truncated) counterCodes.push('scan-truncated');
    if (report.coverage.skippedLargeFiles > 0) counterCodes.push('large-files-skipped');
    if (report.coverage.unreadableFiles > 0) counterCodes.push('unreadable-files');
    if (report.coverage.skippedSymlinks > 0) counterCodes.push('symlinks-skipped');
    if (report.coverage.outsideRootPaths > 0) counterCodes.push('outside-root-rejected');
    const counterTexts = counterCodes.map((code) =>
        textsOf(explainReasonCode(code, { projectId: report.projectId, sourceRevision: report.sourceRevision, subjectId: 'coverage' })),
    );

    const actions = dedupeActions([...reasonTexts, ...counterTexts].flatMap((texts) => texts.actions)).slice(0, 8);
    const verification = dedupeTexts([...reasonTexts, ...counterTexts].flatMap((texts) => texts.verification)).slice(0, 8);

    const modeDefaults: Record<
        ComplianceReport['measurement'],
        { summary: LocalizedText; whatItMeans: LocalizedText; whyItMatters: LocalizedText; verification: LocalizedText; limitation?: LocalizedText }
    > = {
        measured: {
            summary: { tr: 'Kapsam: uygun dosyaların tamamı tarandı', en: 'Coverage: all eligible files were scanned' },
            whatItMeans: { tr: 'Uyum taraması, kuralları değerlendirebileceği tüm dosyaları okudu.', en: 'The compliance scan read every file it could evaluate.' },
            whyItMatters: { tr: 'Kapsam sayıları, bulguların ne kadarının eksik olabileceğini dürüstçe gösterir.', en: 'Coverage counters show honestly how much could still be missing.' },
            verification: { tr: 'Sonraki koşumda kapsam sayaçlarının kararlı kaldığını görmek.', en: 'Confirm the coverage counters stay stable in the next run.' },
        },
        partial: {
            summary: { tr: 'Kapsam kısmi: bir kısım dosya ölçülemedi', en: 'Partial coverage: some files were not measured' },
            whatItMeans: {
                tr: 'Tarama tamamlandı ama bir kısım dosya ölçüm dışı kaldı; nedenler teknik kanıtta listelenir.',
                en: 'The scan finished, but part of the files stayed unmeasured; reasons are listed in technical evidence.',
            },
            whyItMatters: { tr: 'Kısmi kapsamda ihlal sayıları alt sınırdır; eksik, temiz anlamına gelmez.', en: 'With partial coverage counts are lower bounds; missing is not the same as clean.' },
            verification: { tr: 'Nedenler giderildikten sonra kapsamın ölçülmüş düzeyine yükseldiğini görmek.', en: 'After the reasons are fixed, confirm coverage rises to measured.' },
            limitation: { tr: 'Kısmi kapsamda sayılar alt sınırdır.', en: 'With partial coverage the counts are lower bounds.' },
        },
        unmeasured: {
            summary: { tr: 'Uyum taraması ölçülemedi', en: 'The compliance scan could not measure' },
            whatItMeans: {
                tr: 'Motor hiçbir dosyayı değerlendiremedi; ihlal listesi boşluk değil, eksik ölçümdür.',
                en: 'The engine could not evaluate any file; the violation list is missing data, not emptiness.',
            },
            whyItMatters: { tr: 'Ölçüsüz koşum temiz görünür ama hiçbir şeyi doğrulamaz.', en: 'An unmeasured run looks clean but proves nothing.' },
            verification: { tr: 'Nedenler giderildikten sonra taramanın dosya okuduğunu görmek.', en: 'After the reasons are fixed, confirm the scan reads files again.' },
            limitation: {
                tr: 'Bu koşumda hiçbir kural değerlendirilmedi; boş ihlal listesi temizlik SAYILMAZ.',
                en: 'No rule was evaluated in this run; an empty violation list does NOT count as clean.',
            },
        },
    };
    const defaults = modeDefaults[report.measurement];

    let limitations: LocalizedText[] = [];
    if (defaults.limitation) limitations.push(defaults.limitation);
    limitations = limitations.concat(reasonTexts.flatMap((texts) => texts.limitations));
    if (report.measurement !== 'measured' && report.reasons.length === 0) {
        limitations = appendLimitation(limitations, {
            tr: 'Ölçüm engellendi ancak neden kodu üretilmedi; bu boşluk dürüstçe işaretlenir.',
            en: 'Measurement was blocked but no reason code was produced; this gap is flagged honestly.',
        });
    }

    return baseEnvelope({
        projectId: report.projectId,
        sourceRevision: report.sourceRevision,
        subjectKind: 'coverage',
        subjectId: 'coverage',
        texts: {
            summary: primary?.summary ?? defaults.summary,
            whatItMeans: primary?.whatItMeans ?? defaults.whatItMeans,
            whyItMatters: primary?.whyItMatters ?? defaults.whyItMatters,
            actions:
                actions.length > 0
                    ? actions
                    : [{ id: 'none', label: { tr: 'Bu kapsam durumu için eyleme gerek yok.', en: 'No action is needed for this coverage state.' } }],
            verification:
                verification.length > 0
                    ? verification
                    : [defaults.verification],
            limitations: limitations.slice(0, 8),
        },
        evidenceRefs: [
            { label: { tr: 'Uygun dosya', en: 'Eligible files' }, value: String(report.coverage.eligibleFiles) },
            { label: { tr: 'Taranan dosya', en: 'Scanned files' }, value: String(report.coverage.scannedFiles) },
            { label: { tr: 'Atlanan büyük dosya', en: 'Skipped large files' }, value: String(report.coverage.skippedLargeFiles) },
            { label: { tr: 'Okunamayan dosya', en: 'Unreadable files' }, value: String(report.coverage.unreadableFiles) },
            { label: { tr: 'Atlanan sembolik bağlantı', en: 'Skipped symlinks' }, value: String(report.coverage.skippedSymlinks) },
            { label: { tr: 'Kök dışı yol', en: 'Outside-root paths' }, value: String(report.coverage.outsideRootPaths) },
            { label: { tr: 'Kırpma', en: 'Truncated' }, value: report.coverage.truncated ? 'true' : 'false' },
        ],
    });
}
