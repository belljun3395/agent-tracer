export type UpdatePlaybookStatusUseCaseDto = "draft" | "active" | "archived";

export interface UpdatePlaybookVariantUseCaseDto {
    readonly label: string;
    readonly description: string;
    readonly differenceFromBase: string;
}

export interface UpdatePlaybookUseCaseIn {
    readonly playbookId: string;
    readonly title?: string;
    readonly status?: UpdatePlaybookStatusUseCaseDto;
    readonly whenToUse?: string | null;
    readonly prerequisites?: readonly string[];
    readonly approach?: string | null;
    readonly keySteps?: readonly string[];
    readonly watchouts?: readonly string[];
    readonly antiPatterns?: readonly string[];
    readonly failureModes?: readonly string[];
    readonly variants?: readonly UpdatePlaybookVariantUseCaseDto[];
    readonly relatedPlaybookIds?: readonly string[];
    readonly sourceSnapshotIds?: readonly string[];
    readonly tags?: readonly string[];
}

export interface UpdatePlaybookRecordUseCaseDto {
    readonly layer: "playbook";
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: UpdatePlaybookStatusUseCaseDto;
    readonly whenToUse: string | null;
    readonly tags: readonly string[];
    readonly useCount: number;
    readonly lastUsedAt: string | null;
    readonly sourceSnapshotIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly prerequisites: readonly string[];
    readonly approach: string | null;
    readonly keySteps: readonly string[];
    readonly watchouts: readonly string[];
    readonly antiPatterns: readonly string[];
    readonly failureModes: readonly string[];
    readonly variants: readonly UpdatePlaybookVariantUseCaseDto[];
    readonly relatedPlaybookIds: readonly string[];
    readonly searchText: string | null;
}

export type UpdatePlaybookUseCaseOut = UpdatePlaybookRecordUseCaseDto | null;
