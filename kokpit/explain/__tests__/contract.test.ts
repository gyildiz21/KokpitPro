// Dilim 5.2 sözleşme nöbetçisi — ExplanationEnvelope v1 (DESIGN D8).
//
// Alan listesinin DESIGN D8 ile birebir eşliği, güvenli eylem kimliği
// kümesi ve AI proposal'ının yapısal garantisi burada dondurulur. Bu
// testler kırılırsa sözleşme değişmiş demektir; değişiklik Patron GO'suna tabidir.

import { describe, expect, it } from 'vitest';
import {
    AiExplanationProposal,
    ExplanationActionId,
    ExplanationEnvelopeObject,
    ExplanationSubjectKind,
} from '../schema';

const D8_FIELDS = [
    'schemaVersion',
    'projectId',
    'sourceRevision',
    'subjectKind',
    'subjectId',
    'origin',
    'summary',
    'whatItMeans',
    'whyItMatters',
    'recommendedActions',
    'verificationSteps',
    'evidenceRefs',
    'limitations',
    'generatedAt',
    'provider',
    'model',
    'confidence',
];

const SUBJECT_KINDS = ['violation', 'sync', 'conflict', 'delta-item', 'plan-slice', 'coverage'];

const ACTION_IDS = [
    'reindex',
    'link-local-checkout',
    'map-plan-path',
    'open-record',
    'select-item',
    'rebuild-index',
    'verify-token-registry',
    'run-compliance',
    'human-review',
    'none',
];

describe('Dilim 5.2 sözleşme nöbetçisi — DESIGN D8 eşliği', () => {
    it('zarf alan listesi DESIGN D8 ile birebir eştir', () => {
        expect(Object.keys(ExplanationEnvelopeObject.shape)).toEqual(D8_FIELDS);
    });

    it('schemaVersion literal 1e sabittir', () => {
        expect(ExplanationEnvelopeObject.shape.schemaVersion.value).toBe(1);
    });

    it('konu türleri kümesi sabittir', () => {
        expect(ExplanationSubjectKind.options).toEqual(SUBJECT_KINDS);
    });

    it('güvenli eylem kimlikleri kümesi sabittir', () => {
        expect(ExplanationActionId.options).toEqual(ACTION_IDS);
    });

    it('origin kümesi yalnız deterministic|ai içerir', () => {
        expect(ExplanationEnvelopeObject.shape.origin.options).toEqual(['deterministic', 'ai']);
    });

    it('AI proposal ölçülmüş gerçek tipini TAŞIYAMAZ — yapısal garanti', () => {
        expect(Object.keys(AiExplanationProposal.shape).sort()).toEqual(
            ['confidence', 'limitations', 'recommendedActions', 'summary', 'whatItMeans', 'whyItMatters'],
        );
        const forbidden = ['severity', 'state', 'addedEdges', 'removedEdges', 'affectedPaths', 'accepted', 'closedAt', 'evidenceRefs', 'verificationSteps', 'subjectKind'];
        for (const key of forbidden) {
            expect(key in AiExplanationProposal.shape).toBe(false);
        }
    });
});
