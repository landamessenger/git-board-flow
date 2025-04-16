import { createClient } from '@supabase/supabase-js';
import { ChunkedFile } from '../model/chunked_file';
import { SupabaseConfig } from '../model/supabase_config';
export class SupabaseRepository {
    private readonly CHUNKS_TABLE = 'chunks';
    private readonly MAX_BATCH_SIZE = 500;
    private readonly MAX_PARALLEL_BATCHES = 5;
    private supabase: any;

    constructor(config: SupabaseConfig) {
        this.supabase = createClient(config.getUrl(), config.getKey());
    }

    private async processBatch(project: string, branch: string, documents: ChunkedFile[]): Promise<void> {
        try {
            const finalBranch = branch.replace(/\//g, '-');
            const { error } = await this.supabase
                .from(this.CHUNKS_TABLE)
                .upsert(
                    documents.map(doc => ({
                        project,
                        branch: finalBranch,
                        ...doc
                    }))
                );

            if (error) {
                throw error;
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Supabase error in batch: ${error.message}`);
            }
            throw error;
        }
    }

    setAllChunkedFiles = async (project: string, branch: string, documents: ChunkedFile[]): Promise<void> => {
        const batches: ChunkedFile[][] = [];
        
        // Split documents into batches
        for (let i = 0; i < documents.length; i += this.MAX_BATCH_SIZE) {
            batches.push(documents.slice(i, i + this.MAX_BATCH_SIZE));
        }

        // Process batches in parallel groups
        for (let i = 0; i < batches.length; i += this.MAX_PARALLEL_BATCHES) {
            const parallelBatches = batches.slice(i, i + this.MAX_PARALLEL_BATCHES);
            await Promise.all(
                parallelBatches.map(batch => this.processBatch(project, branch, batch))
            );
        }
    }

    setChunkedFile = async (project: string, branch: string, document: ChunkedFile): Promise<void> => {
        const finalBranch = branch.replace(/\//g, '-');
        const { error } = await this.supabase
            .from(this.CHUNKS_TABLE)
            .upsert({
                project,
                branch: finalBranch,
                ...document
            });

        if (error) {
            throw error;
        }
    }

    getChunkedFiles = async (project: string, branch: string, shasum: string): Promise<ChunkedFile[]> => {
        const finalBranch = branch.replace(/\//g, '-');
        const { data, error } = await this.supabase
            .from(this.CHUNKS_TABLE)
            .select('*')
            .eq('project', project)
            .eq('branch', finalBranch)
            .eq('shasum', shasum);

        if (error) {
            throw error;
        }

        return data.map((doc: Record<string, unknown>) => {
            const { project, branch, ...rest } = doc;
            return new ChunkedFile(
                rest.path as string,
                rest.index as number,
                rest.content as string,
                rest.chunks as string[]
            );
        });
    }
} 