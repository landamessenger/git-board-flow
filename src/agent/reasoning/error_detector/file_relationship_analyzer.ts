/**
 * File Relationship Analyzer
 * Analyzes file relationships and finds consumers/dependencies
 */

import { FileImportAnalyzer } from '../../../usecase/steps/common/services/file_import_analyzer';
import { logInfo, logWarn } from '../../../utils/logger';

export interface FileRelationshipResult {
  targetFile: string;
  consumers: string[]; // Files that import/use the target file
  dependencies: string[]; // Files that the target file imports/uses
  allRelatedFiles: string[]; // All files to analyze (target + consumers + optionally dependencies)
}

export class FileRelationshipAnalyzer {
  private fileImportAnalyzer: FileImportAnalyzer;

  constructor() {
    this.fileImportAnalyzer = new FileImportAnalyzer();
  }

  /**
   * Analyze relationships for a target file
   */
  analyzeFileRelationships(
    targetFile: string,
    repositoryFiles: Map<string, string>,
    includeDependencies: boolean = false
  ): FileRelationshipResult | null {
    // Check if target file exists
    if (!repositoryFiles.has(targetFile)) {
      logWarn(`⚠️ Target file not found: ${targetFile}`);
      // Try to find similar file paths
      const similarFiles = Array.from(repositoryFiles.keys()).filter(path => 
        path.includes(targetFile) || targetFile.includes(path)
      );
      if (similarFiles.length > 0) {
        logWarn(`   Did you mean one of these? ${similarFiles.slice(0, 5).join(', ')}`);
      }
      return null;
    }

    logInfo(`🔗 Analyzing relationships for: ${targetFile}`);

    // Build relationship map
    const relationshipMaps = this.fileImportAnalyzer.buildRelationshipMap(repositoryFiles);
    const consumesMap = relationshipMaps.consumes;
    const consumedByMap = relationshipMaps.consumedBy;

    // Get consumers (files that import/use the target file)
    const consumers = consumedByMap.get(targetFile) || [];
    
    // Get dependencies (files that the target file imports/uses)
    const dependencies = consumesMap.get(targetFile) || [];

    // Build list of all related files to analyze
    const allRelatedFiles: string[] = [targetFile]; // Always include target file
    
    // Add consumers
    consumers.forEach(consumer => {
      if (!allRelatedFiles.includes(consumer)) {
        allRelatedFiles.push(consumer);
      }
    });

    // Optionally add dependencies
    if (includeDependencies) {
      dependencies.forEach(dep => {
        if (!allRelatedFiles.includes(dep)) {
          allRelatedFiles.push(dep);
        }
      });
    }

    logInfo(`   📊 Found ${consumers.length} consumer(s) and ${dependencies.length} dependency/dependencies`);
    logInfo(`   📁 Total files to analyze: ${allRelatedFiles.length}`);

    if (consumers.length > 0) {
      logInfo(`   📥 Consumers: ${consumers.slice(0, 5).join(', ')}${consumers.length > 5 ? ` ... and ${consumers.length - 5} more` : ''}`);
    }

    if (includeDependencies && dependencies.length > 0) {
      logInfo(`   📤 Dependencies: ${dependencies.slice(0, 5).join(', ')}${dependencies.length > 5 ? ` ... and ${dependencies.length - 5} more` : ''}`);
    }

    return {
      targetFile,
      consumers,
      dependencies,
      allRelatedFiles
    };
  }
}

