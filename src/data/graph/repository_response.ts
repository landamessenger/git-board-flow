export type RepositoryResponse = {
    repository: {
        id: string;
        issue: { id: string } | null;
        ref: {
            target: {
                oid: string;
            } | null;
        } | null;
    } | null;
};
