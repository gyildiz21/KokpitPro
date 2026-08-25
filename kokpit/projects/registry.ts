import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ProjectRecord, RegistryFile, type ProjectRecord as ProjectRecordType, type RegistryFile as RegistryFileType } from './schema';

const EMPTY_REGISTRY: RegistryFileType = { version: 1, activeProjectId: null, projects: [] };

export class ProjectRegistry {
    readonly dataDir: string;
    readonly filePath: string;

    constructor(dataDir = process.env.KOKPIT_DATA_DIR || resolve(process.cwd(), '.kokpit', 'data')) {
        this.dataDir = resolve(dataDir);
        this.filePath = join(this.dataDir, 'projects.json');
    }

    read(): RegistryFileType {
        if (!existsSync(this.filePath)) return structuredClone(EMPTY_REGISTRY);
        return RegistryFile.parse(JSON.parse(readFileSync(this.filePath, 'utf8')));
    }

    write(next: RegistryFileType): RegistryFileType {
        const validated = RegistryFile.parse(next);
        mkdirSync(this.dataDir, { recursive: true });
        const temporary = `${this.filePath}.${process.pid}.tmp`;
        try {
            writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
            renameSync(temporary, this.filePath);
            chmodSync(this.filePath, 0o600);
        } finally {
            if (existsSync(temporary)) unlinkSync(temporary);
        }
        return validated;
    }

    upsert(project: ProjectRecordType, makeActive = false): RegistryFileType {
        const validated = ProjectRecord.parse(project);
        const registry = this.read();
        const index = registry.projects.findIndex((entry) => entry.id === validated.id);
        if (index >= 0) registry.projects[index] = validated;
        else registry.projects.push(validated);
        if (makeActive || !registry.activeProjectId) registry.activeProjectId = validated.id;
        return this.write(registry);
    }

    setActive(projectId: string): RegistryFileType {
        const registry = this.read();
        if (!registry.projects.some((project) => project.id === projectId)) {
            throw new Error(`Project not found: ${projectId}`);
        }
        registry.activeProjectId = projectId;
        return this.write(registry);
    }

    remove(projectId: string): RegistryFileType {
        const registry = this.read();
        registry.projects = registry.projects.filter((project) => project.id !== projectId);
        if (registry.activeProjectId === projectId) registry.activeProjectId = registry.projects[0]?.id ?? null;
        return this.write(registry);
    }
}
