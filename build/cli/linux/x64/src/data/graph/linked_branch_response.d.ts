type LinkedBranchResponse = {
    createLinkedBranch: {
        linkedBranch: {
            id: string;
            ref: {
                name: string;
            } | null;
        } | null;
    } | null;
};
