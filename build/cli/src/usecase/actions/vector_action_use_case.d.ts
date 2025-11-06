import { Execution } from '../../data/model/execution';
import { Result } from '../../data/model/result';
import { ParamUseCase } from '../base/param_usecase';
export declare class VectorActionUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string;
    private fileRepository;
    private aiRepository;
    private readonly CODE_INSTRUCTION_BLOCK;
    private readonly CODE_INSTRUCTION_LINE;
    invoke(param: Execution): Promise<Result[]>;
    private checkChunksInSupabase;
    private uploadChunksToSupabase;
    private duplicateChunksToBranch;
    /**
     * Extract imports from a file regardless of programming language
     */
    private extractImportsFromFile;
    /**
     * Resolve relative import path to absolute path
     */
    private resolveRelativePath;
    /**
     * Build relationship map from all files by extracting imports
     */
    private buildRelationshipMap;
    /**
     * Calculate SHA256 hash of file content
     */
    private calculateFileSHA;
    /**
     * Generate basic description from file path (fallback)
     */
    private generateBasicDescription;
}
