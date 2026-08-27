// Dilim 5 · Kapatma denetim kaydı (UI-SPEC §10.4: kapatma gerekçesiz
// olamaz; gerekçe + kim + zaman audit'e yazılır).
//
// Depo DeltaHistoryStore desenindedir: atomik yazım (tmp+rename), sürümlü
// dosya, .strict() şema. Gerekçe boşsa yukarı akışta ClosureRequest zaten
// reddeder; burada ikinci savunma katı olarak da korunur.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { sortViolations } from './rules';
import type { ComplianceReport as ComplianceReportType, Violation } from './schema';

export const ClosureRecord = z
    .object({
        projectId: z.string().min(1),
        violationId: z.string().min(1),
        closedAt: z.string().datetime(),
        closedBy: z.string().min(1),
        justification: z.string().min(1),
        rule: z.string().min(1),
        targetPath: z.string().min(1),
        severity: z.string().min(1),
    })
    .strict();
export type ClosureRecord = z.infer<typeof ClosureRecord>;

const ClosureFile = z
    .object({
        version: z.literal(1),
        closures: z.array(ClosureRecord).max(512),
    })
    .strict();
type ClosureFile = z.infer<typeof ClosureFile>;

export class ComplianceClosureStore {
    readonly filePath: string;

    constructor(dataDir = process.env.KOKPIT_DATA_DIR || join(resolve(process.cwd()), '.kokpit', 'data')) {
        this.filePath = join(dataDir, 'compliance-audit.json');
    }

    private readAll(): ClosureFile {
        if (!existsSync(this.filePath)) return { version: 1, closures: [] };
        return ClosureFile.parse(JSON.parse(readFileSync(this.filePath, 'utf8')));
    }

    private writeAll(next: ClosureFile): void {
        mkdirSync(dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        try {
            writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
            renameSync(temporary, this.filePath);
        } finally {
            if (existsSync(temporary)) unlinkSync(temporary);
        }
    }

    list(projectId: string): ClosureRecord[] {
        return this.readAll().closures.filter((closure) => closure.projectId === projectId);
    }

    add(record: ClosureRecord): void {
        const file = this.readAll();
        if (file.closures.some((closure) => closure.projectId === record.projectId && closure.violationId === record.violationId)) {
            throw new Error(`Violation is already closed: ${record.violationId}`);
        }
        file.closures.push(ClosureRecord.parse(record));
        this.writeAll(file);
    }
}

/**
 * Kapatma kayıtlarını canlı rapora uygular: eşleşen ihlal `closed` duruma
 * geçer ve kim/zaman/gerekçe alanları damgalanır. Sağlık bantları yalnız
 * AÇIK ihlalleri sayar — kapatılan kayıt triage'ın "Gerekçeyle kapalı"
 * kuyruğuna düşer, aktif bant sayısını şişirmez.
 */
export function applyClosures(report: ComplianceReportType, closures: ClosureRecord[]): ComplianceReportType {
    const byId = new Map(closures.map((closure) => [closure.violationId, closure]));
    const violations: Violation[] = report.violations.map((violation) => {
        const closure = byId.get(violation.id);
        if (!closure) return violation;
        return {
            ...violation,
            state: 'closed',
            closedAt: closure.closedAt,
            closedBy: closure.closedBy,
            closureJustification: closure.justification,
        };
    });
    return {
        ...report,
        violations: sortViolations(violations),
        health: {
            ...report.health,
            vioErr: violations.filter((violation) => violation.state === 'open' && violation.severity === 'error').length,
            vioWarn: violations.filter((violation) => violation.state === 'open' && violation.severity === 'warning').length,
        },
    };
}
