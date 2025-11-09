import { Execution } from "../../data/model/execution";
import { IssueRepository } from "../../data/repository/issue_repository";
import { ProjectRepository } from "../../data/repository/project_repository";
import { SupabaseRepository } from "../../data/repository/supabase_repository";
import { Result } from "../../data/model/result";
import { ParamUseCase } from "../base/param_usecase";
import { logError, logInfo } from "../../utils/logger";

export class InitialSetupUseCase implements ParamUseCase<Execution, Result[]> {
    taskId: string = 'InitialSetupUseCase';

    async invoke(param: Execution): Promise<Result[]> {
        logInfo(`Executing ${this.taskId}.`);

        const results: Result[] = [];
        const steps: string[] = [];
        const errors: string[] = [];

        try {
            // 1. Verificar acceso a GitHub con Personal Access Token
            logInfo('🔐 Checking GitHub access...');
            const githubAccessResult = await this.verifyGitHubAccess(param);
            if (!githubAccessResult.success) {
                errors.push(...githubAccessResult.errors);
                results.push(
                    new Result({
                        id: this.taskId,
                        success: false,
                        executed: true,
                        steps: steps,
                        errors: errors,
                    })
                );
                return results;
            }
            steps.push(`✅ GitHub access verified: ${githubAccessResult.user}`);

            // 2. Crear todos los labels necesarios
            logInfo('🏷️  Checking labels...');
            const labelsResult = await this.ensureLabels(param);
            if (!labelsResult.success) {
                errors.push(...labelsResult.errors);
                logError(`Error checking labels: ${labelsResult.errors}`);
            } else {
                steps.push(`✅ Labels checked: ${labelsResult.created} created, ${labelsResult.existing} already existed`);
            }

            // 3. Crear todos los tipos de Issue si no existen
            logInfo('📋 Checking issue types...');
            const issueTypesResult = await this.ensureIssueTypes(param);
            if (!issueTypesResult.success) {
                errors.push(...issueTypesResult.errors);
            } else {
                steps.push(`✅ Issue types checked: ${issueTypesResult.created} created, ${issueTypesResult.existing} already existed`);
            }

            // 4. Verificar acceso a Supabase y ejecutar migraciones si es necesario
            if (param.supabaseConfig) {
                logInfo('🗄️  Checking Supabase access...');
                const supabaseResult = await this.verifyAndSetupSupabase(param);
                if (!supabaseResult.success) {
                    errors.push(...supabaseResult.errors);
                } else {
                    steps.push(`✅ Supabase checked and configured correctly`);
                }
            } else {
                steps.push('⚠️  Supabase not configured, skipping verification');
            }

            results.push(
                new Result({
                    id: this.taskId,
                    success: errors.length === 0,
                    executed: true,
                    steps: steps,
                    errors: errors.length > 0 ? errors : undefined,
                })
            );
        } catch (error) {
            logError(error);
            errors.push(`Error ejecutando setup inicial: ${error}`);
            results.push(
                new Result({
                    id: this.taskId,
                    success: false,
                    executed: true,
                    steps: steps,
                    errors: errors,
                })
            );
        }

        return results;
    }

    private async verifyGitHubAccess(param: Execution): Promise<{ success: boolean; user?: string; errors: string[] }> {
        const errors: string[] = [];
        try {
            const projectRepository = new ProjectRepository();
            const user = await projectRepository.getUserFromToken(param.tokens.token);
            return { success: true, user, errors: [] };
        } catch (error) {
            logError(`Error verificando acceso a GitHub: ${error}`);
            errors.push(`No se pudo verificar el acceso a GitHub: ${error}`);
            return { success: false, errors };
        }
    }

    private async ensureLabels(param: Execution): Promise<{ success: boolean; created: number; existing: number; errors: string[] }> {
        try {
            const issueRepository = new IssueRepository();
            const result = await issueRepository.ensureLabels(
                param.owner,
                param.repo,
                param.labels,
                param.tokens.token
            );
            return {
                success: result.errors.length === 0,
                created: result.created,
                existing: result.existing,
                errors: result.errors,
            };
        } catch (error) {
            logError(`Error asegurando labels: ${error}`);
            return { success: false, created: 0, existing: 0, errors: [`Error asegurando labels: ${error}`] };
        }
    }

    private async ensureIssueTypes(param: Execution): Promise<{ success: boolean; created: number; existing: number; errors: string[] }> {
        try {
            const issueRepository = new IssueRepository();
            const result = await issueRepository.ensureIssueTypes(
                param.owner,
                param.issueTypes,
                param.tokens.token
            );
            return {
                success: result.errors.length === 0,
                created: result.created,
                existing: result.existing,
                errors: result.errors,
            };
        } catch (error) {
            logError(`Error asegurando tipos de Issue: ${error}`);
            return { success: false, created: 0, existing: 0, errors: [`Error asegurando tipos de Issue: ${error}`] };
        }
    }

    private async verifyAndSetupSupabase(param: Execution): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];

        try {
            if (!param.supabaseConfig) {
                errors.push('Supabase no está configurado');
                return { success: false, errors };
            }

            const supabaseRepository = new SupabaseRepository(param.supabaseConfig);

            // Verificar que la tabla ai_file_cache existe
            const tableCheck = await supabaseRepository.verifyTableExists('ai_file_cache');
            if (!tableCheck.exists) {
                errors.push('La tabla ai_file_cache no existe. Por favor, ejecuta las migraciones de Supabase manualmente desde: supabase/migrations/');
                return { success: false, errors };
            }

            // Verificar que las funciones RPC existan
            const requiredFunctions = [
                { name: 'duplicate_ai_file_cache_by_branch', params: { owner_param: 'test', repository_param: 'test', source_branch_param: 'test', target_branch_param: 'test' } },
                { name: 'delete_ai_file_cache_by_branch', params: { owner_param: 'test', repository_param: 'test', branch_param: 'test' } },
            ];

            for (const func of requiredFunctions) {
                const functionCheck = await supabaseRepository.verifyRpcFunctionExists(func.name, func.params);
                if (!functionCheck.exists) {
                    errors.push(`La función RPC "${func.name}" no existe. Por favor, ejecuta las migraciones de Supabase manualmente desde: supabase/migrations/`);
                }
            }

            if (errors.length > 0) {
                return { success: false, errors };
            }

            return { success: true, errors: [] };
        } catch (error) {
            logError(`Error verificando/configurando Supabase: ${error}`);
            errors.push(`Error verificando/configurando Supabase: ${error}`);
            return { success: false, errors };
        }
    }

}

