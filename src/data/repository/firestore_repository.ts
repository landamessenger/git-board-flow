import { getApps, initializeApp } from 'firebase/app';
import { Firestore, FirestoreError, collection, doc, getFirestore, writeBatch } from 'firebase/firestore';
import { ChunkedFile } from '../model/chunked_file';

export class FirestoreRepository {
    private readonly CHUNKS_COLLECTION = 'chunks';
    private readonly MAX_BATCH_SIZE = 500;
    private readonly MAX_PARALLEL_BATCHES = 5;
    private config: any;

    private getFirestore(): Firestore {
        const app = getApps().length === 0 ? initializeApp(this.config) : getApps()[0];
        return getFirestore(app);
    }

    constructor(config: any) {
        this.config = config;
    }

    private async processBatch(project: string, branch: string, documents: ChunkedFile[]): Promise<void> {
        try {
            const batch = writeBatch(this.getFirestore());
            const proyectCollection = collection(this.getFirestore(), project);
            const branchDocument = doc(proyectCollection, branch);
            const filesCollection = collection(branchDocument, this.CHUNKS_COLLECTION);

            documents.forEach((chunkedFile) => {
                const chunkDocument = doc(filesCollection, chunkedFile.id);
                batch.set(chunkDocument, chunkedFile);
            });

            await batch.commit();
        } catch (error) {
            if (error instanceof FirestoreError) {
                console.error(`Firestore error in batch: ${error.code} - ${error.message}`);
            }
            throw error;
        }
    }

    setAllChunkedFiles = async (project: string, branch: string, documents: ChunkedFile[]): Promise<void> => {
        const finalBranch = branch.replace(/\//g, '-')
        const batches: ChunkedFile[][] = [];
        
        // Split documents into batches
        for (let i = 0; i < documents.length; i += this.MAX_BATCH_SIZE) {
            batches.push(documents.slice(i, i + this.MAX_BATCH_SIZE));
        }

        // Process batches in parallel groups
        for (let i = 0; i < batches.length; i += this.MAX_PARALLEL_BATCHES) {
            const parallelBatches = batches.slice(i, i + this.MAX_PARALLEL_BATCHES);
            await Promise.all(
                parallelBatches.map(batch => this.processBatch(project, finalBranch, batch))
            );
        }
    }
}