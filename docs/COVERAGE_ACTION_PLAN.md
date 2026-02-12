# Plan de acción: cobertura de tests al 100%

Objetivo: llevar la cobertura desde ~46% a la máxima posible, sin dejar archivos sin testear.

**Criterios:**
- ✅ Archivo con tests dedicados o cubierto por tests existentes
- ✅ Líneas y ramas sin cubrir documentadas con tests nuevos o ampliados
- Orden: rápido impacto primero, luego capas que dependen de otras

---

## Fase 0: Utilidades (rápido, sin dependencias de GitHub API)

| # | Archivo | Cobertura actual | Acción |
|---|---------|------------------|--------|
| 0.1 | `src/utils/queue_utils.ts` | 0% (22 líneas) | Crear `src/utils/__tests__/queue_utils.test.ts` |
| 0.2 | `src/utils/logger.ts` | 0% (100 líneas) | Crear `src/utils/__tests__/logger.test.ts` |
| 0.3 | `src/utils/opencode_server.ts` | 0% (192 líneas) | Crear `src/utils/__tests__/opencode_server.test.ts` (mock HTTP/axios) |
| 0.4 | `src/utils/label_utils.ts` | 90% (líneas 42-44) | Añadir casos en `label_utils.test.ts` para ramas faltantes |
| 0.5 | `src/utils/setup_files.ts` | 94% (67-68, 80-81) | Añadir tests en `setup_files.test.ts` |
| 0.6 | `src/utils/version_utils.ts` | 96% (línea 36) | Añadir caso en `version_utils.test.ts` |

---

## Fase 1: Modelos de datos (`src/data/model/`)

Muchos se cubren indirectamente al testear use cases; los que son solo tipos/constantes pueden tener tests mínimos (ej. que exporten lo esperado). Prioridad: los que contienen lógica.

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 1.1 | `commit.ts` | 0% (22 líneas) | Tests que construyan `Commit` y validen campos; o cubrir vía `commit_use_case` |
| 1.2 | `execution.ts` | 0% (406 líneas) | Crear `__tests__/execution.test.ts` para builders/helpers; o cubrir vía actions |
| 1.3 | `issue.ts` | 0% (75 líneas) | Tests de construcción/parsing; o cubrir vía use cases que usan Issue |
| 1.4 | `pull_request.ts` | 0% (116 líneas) | Idem |
| 1.5 | `single_action.ts` | 0% (121 líneas) | Idem |
| 1.6 | `workflow_run.ts` | 0% (22-66) | Tests o cubrir vía workflow_repository |
| 1.7 | `labels.ts` | 0% (245 líneas) | Tests de constantes/helpers; muchas líneas son datos |
| 1.8 | `issue_types.ts` | 0% (2-102) | Idem |
| 1.9 | `images.ts` | 0% (78 líneas) | Idem |
| 1.10 | `projects.ts`, `workflows.ts`, `locale.ts`, `milestone.ts`, `tokens.ts`, `welcome.ts`, `emoji.ts`, `hotfix.ts`, `release.ts`, `size_threshold.ts`, `size_thresholds.ts` | 0% | Tests mínimos (export + uso en tests existentes) o archivo de test que importe y compruebe estructura |
| 1.11 | `ai.ts` | 82% (50-54, 62, 74, 85) | Añadir casos en test existente o crear `ai.test.ts` para ramas faltantes |
| 1.12 | `branches.ts` | 90.9% (línea 14) | Cubrir rama en tests de model |
| 1.13 | `project_detail.ts` | 14.28% (11-16) | Tests de parsing/construcción |

---

## Fase 2: Repositorios (`src/data/repository/`)

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 2.1 | `workflow_repository.ts` | 0% (43 líneas) | Crear `__tests__/workflow_repository.test.ts` (mock GitHub API) |
| 2.2 | `branch_repository.ts` | 14% | Ampliar tests: métodos no cubiertos (líneas 16-25, 30-57, 62-94, 123-249, 253-275, 293, 327-338, 384-385, 406-430, 439-459, 470-471, 488-683, 693-739, 752-811). Considerar dividir en más archivos de test por grupo de métodos |
| 2.3 | `project_repository.ts` | 15% | Ampliar `project_repository.test.ts`: cubrir 20-79, 90-171, 179-231, 236-260, 272-413, 423, 440, 457, 473-521, 528-554, 558-560, 587-588, 600-607, 611-620, 625-630, 634-655, 666-718, 722-738, 743-772 |
| 2.4 | `pull_request_repository.ts` | 17% | Crear/ampliar tests para 16-29, 67-68, 76-91, 102-110, 120-128, 141-169, 180-199, 209-239, 252-267, 283-306, 317-327, 342-365, 380-390, 407-506, 522-550, 562-569 |
| 2.5 | `issue_repository.ts` | 0% (1166 líneas) | Crear `__tests__/issue_repository.test.ts` por bloques: list comments, create comment, update, get issue, etc. (mock Octokit) |
| 2.6 | `ai_repository.ts` | 90.52% (105-106, 109-110, 127, 138, 158-162, 202, 209-214, 236, 359) | Añadir tests para líneas/ramas faltantes en `ai_repository.test.ts` |

---

## Fase 3: Manager (`src/manager/description/`)

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 3.1 | `configuration_handler.ts` | 0% (70 líneas) | Crear `__tests__/configuration_handler.test.ts` |
| 3.2 | `markdown_content_hotfix_handler.ts` | 0% (2-32) | Crear `__tests__/markdown_content_hotfix_handler.test.ts` |
| 3.3 | `base/content_interface.ts` | 0% (79 líneas) | Tests de implementaciones o mocks que usen la interfaz |
| 3.4 | `base/issue_content_interface.ts` | 0% (2-84) | Idem |

---

## Fase 4: Use cases orquestadores (src/usecase/*.ts)

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 4.1 | `commit_use_case.ts` | 0% (2-46) | Crear `src/usecase/__tests__/commit_use_case.test.ts` (mock steps y repos) |
| 4.2 | `issue_use_case.ts` | 0% (3-103) | Crear `src/usecase/__tests__/issue_use_case.test.ts` |
| 4.3 | `pull_request_use_case.ts` | 0% (2-100) | Crear `src/usecase/__tests__/pull_request_use_case.test.ts` |
| 4.4 | `single_action_use_case.ts` | 0% (2-62) | Crear `src/usecase/__tests__/single_action_use_case.test.ts` |
| 4.5 | `issue_comment_use_case.ts` | 96.96% (109-110) | Añadir 1–2 tests para líneas 109-110 en `issue_comment_use_case.test.ts` |
| 4.6 | `pull_request_review_comment_use_case.ts` | 95.45% (53, 109-110) | Añadir tests para ramas 53 y 109-110 |

---

## Fase 5: Use case actions (`src/usecase/actions/`)

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 5.1 | `check_progress_use_case.ts` | 89% (239-242, 269-270, 356-361) | Añadir casos en `check_progress_use_case.test.ts` |
| 5.2 | `initial_setup_use_case.ts` | 85% (69, 84-86, 129-130, 143-144, 163-164) | Añadir casos en `initial_setup_use_case.test.ts` |
| 5.3 | `deployed_action_use_case.ts` | 100% líneas, rama 133 | Añadir test que cubra rama 133 |
| 5.4 | `recommend_steps_use_case.ts` | rama 84 | Añadir test para rama 84 |

---

## Fase 6: Steps commit (`src/usecase/steps/commit/`)

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 6.1 | `check_changes_issue_size_use_case.ts` | 78% (29-30, 65, 82-107) | Ampliar `check_changes_issue_size_use_case.test.ts` |
| 6.2 | `notify_new_commit_on_issue_use_case.ts` | 65% (27-33, 39-40, 42-43, 45-46, 50-58, 84, 89, 102) | Ampliar `notify_new_commit_on_issue_use_case.test.ts` |
| 6.3 | `user_request_use_case.ts` | ramas 27, 70 | Añadir tests en `user_request_use_case.test.ts` |

---

## Fase 7: Steps commit/bugbot

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 7.1 | `bugbot_autofix_commit.ts` | 83% (94-97, 105, 127, 152-154, 192, 260-262, 268, 272-275, 278-281, 312-314) | Ampliar `bugbot_autofix_commit.test.ts` |
| 7.2 | `bugbot_autofix_use_case.ts` | 94% (58-59) | Añadir tests en `bugbot_autofix_use_case.test.ts` |
| 7.3 | `bugbot_fix_intent_payload.ts` | 91% (línea 25) | Añadir caso en test existente |
| 7.4 | `build_bugbot_fix_intent_prompt.ts` | ramas 35, 38, 47-48 | Añadir casos en `build_bugbot_fix_intent_prompt.test.ts` |
| 7.5 | `build_bugbot_fix_prompt.ts` | 93% (33, 44-47) | Añadir casos en `build_bugbot_fix_prompt.test.ts` |
| 7.6 | `build_bugbot_prompt.ts` | rama 14 | Añadir caso en `build_bugbot_prompt.test.ts` |
| 7.7 | `file_ignore.ts` | 97% (línea 43) | Añadir caso en `file_ignore.test.ts` |
| 7.8 | `load_bugbot_context_use_case.ts` | 97% (78-79) | Añadir caso en `load_bugbot_context_use_case.test.ts` |
| 7.9 | `mark_findings_resolved_use_case.ts` | 95% (88, 121) | Añadir casos en `mark_findings_resolved_use_case.test.ts` |
| 7.10 | `marker.ts` | rama 85 | Añadir caso en `marker.test.ts` |
| 7.11 | `publish_findings_use_case.ts` | ramas 99-100 | Añadir caso en `publish_findings_use_case.test.ts` |
| 7.12 | `detect_bugbot_fix_intent_use_case.ts` | ramas 52, 81, 108, 140 | Añadir casos en `detect_bugbot_fix_intent_use_case.test.ts` |
| 7.13 | `deduplicate_findings.ts` | rama 18 | Añadir caso en `deduplicate_findings.test.ts` |

---

## Fase 8: Steps common

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 8.1 | `execute_script_use_case.ts` | 69% (91-95, 104-133) | Ampliar `execute_script_use_case.test.ts` |
| 8.2 | `get_hotfix_version_use_case.ts` | 88% (24, 26, 95-96) | Añadir casos en `get_hotfix_version_use_case.test.ts` |
| 8.3 | `get_release_type_use_case.ts` | 68% (23-36, 47-55, 83-84) | Ampliar `get_release_type_use_case.test.ts` |
| 8.4 | `get_release_version_use_case.ts` | 81% (24, 26, 61-68, 82-83) | Ampliar `get_release_version_use_case.test.ts` |
| 8.5 | `publish_resume_use_case.ts` | 58% (31-32, 34-35, 37-38, 40-41, 43-44, 46-47, 49-50, 54-55, 57-58, 60-61, 63-64, 66-67, 69-70, 78-81, 96-97, 104-109, 114, 122, 147, 170-171) | Ampliar `publish_resume_use_case.test.ts` (muchas ramas) |
| 8.6 | `think_use_case.ts` | 94% (136-145) | Añadir casos en `think_use_case.test.ts` |
| 8.7 | `update_title_use_case.ts` | 86% (30, 94-118) | Ampliar `update_title_use_case.test.ts` |
| 8.8 | `check_permissions_use_case.ts` | rama 49 | Añadir caso en `check_permissions_use_case.test.ts` |

---

## Fase 9: Steps issue

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 9.1 | `assign_members_to_issue_use_case.ts` | 89% (55-72) | Ampliar `assign_members_to_issue_use_case.test.ts` |
| 9.2 | `assign_reviewers_to_issue_use_case.ts` | rama 95 | Añadir caso en test existente |
| 9.3 | `check_priority_issue_size_use_case.ts` | 93% (36, 38) | Añadir casos en test existente |
| 9.4 | `label_deploy_added_use_case.ts` | 76% (65-96) | Ampliar `label_deploy_added_use_case.test.ts` |
| 9.5 | `label_deployed_added_use_case.ts` | 90% (52-53) | Añadir casos en `label_deployed_added_use_case.test.ts` |
| 9.6 | `link_issue_project_use_case.ts` | rama 57 | Añadir caso en test existente |
| 9.7 | `move_issue_to_in_progress.ts` | ramas 29-53 | Añadir casos en `move_issue_to_in_progress.test.ts` |
| 9.8 | `prepare_branches_use_case.ts` | 45% (63-123, 126-227, 258-263, 271-273, 286, 304-305, 324-337) | Ampliar `prepare_branches_use_case.test.ts` (gran bloque sin cubrir) |
| 9.9 | `remove_issue_branches_use_case.ts` | rama 56 | Añadir caso en test existente |
| 9.10 | `remove_not_needed_branches_use_case.ts` | 81% (54, 76-77, 91-110) | Ampliar `remove_not_needed_branches_use_case.test.ts` |

---

## Fase 10: Steps pull_request y pull_request_review_comment

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 10.1 | `check_priority_pull_request_size_use_case.ts` | 87% (34, 38, 77-78) | Añadir casos en test existente |
| 10.2 | `link_pull_request_issue_use_case.ts` | rama 20 | Añadir caso en test existente |
| 10.3 | `link_pull_request_project_use_case.ts` | rama 28 | Añadir caso en test existente |
| 10.4 | `sync_size_and_progress_labels_from_issue_to_pr_use_case.ts` | ramas 72-101 | Añadir casos en test existente |
| 10.5 | `update_pull_request_description_use_case.ts` | 95% (78-88) | Ampliar `update_pull_request_description_use_case.test.ts` |
| 10.6 | `check_pull_request_comment_language_use_case.ts` | ramas 64, 110-116 | Añadir casos en test existente |
| 10.7 | `check_issue_comment_language_use_case.ts` | rama 64 | Añadir caso en test existente |

---

## Fase 11: Steps commit – detect_potential_problems

| # | Archivo | Cobertura | Acción |
|---|----------|-----------|--------|
| 11.1 | `detect_potential_problems_use_case.ts` | ramas 63, 72 | Añadir casos en `detect_potential_problems_use_case.test.ts` |

---

## Fase 12: Entry points (actions + CLI)

Estos archivos orquestan todo; suelen testearse con integración/E2E. Para cobertura unitaria haría falta mockear GitHub, filesystem, etc.

| # | Archivo | Líneas | Acción |
|---|----------|--------|--------|
| 12.1 | `src/actions/common_action.ts` | 1-93 | Crear `src/actions/__tests__/common_action.test.ts` (mock getOctokit, Execution, use cases) |
| 12.2 | `src/actions/github_action.ts` | 1-703 | Tests unitarios de bloques aislados (parsing inputs, build Execution) o suite de integración |
| 12.3 | `src/actions/local_action.ts` | 1-678 | Idem: parsing config, build Execution |
| 12.4 | `src/cli.ts` | 3-467 | Tests de comandos (mock commander y common_action) o integración |

---

## Fase 13: Data graph (si aplica)

| # | Archivo | Acción |
|---|----------|--------|
| 13.1 | `src/data/graph/linked_branch_response.ts` | Comprobar si entra en cobertura; si no, añadir test que importe y use (o test en branch_repository que use estos tipos) |
| 13.2 | `src/data/graph/project_result.ts` | Idem |
| 13.3 | `src/data/graph/repository_response.ts` | Idem |

---

## Resumen por fases

| Fase | Descripción | Items |
|------|-------------|-------|
| 0 | Utils | 6 |
| 1 | Data model | 13 |
| 2 | Repositories | 6 |
| 3 | Manager | 4 |
| 4 | Use case orquestadores | 6 |
| 5 | Use case actions | 4 |
| 6 | Steps commit | 3 |
| 7 | Steps commit/bugbot | 13 |
| 8 | Steps common | 8 |
| 9 | Steps issue | 10 |
| 10 | Steps PR y PR review comment | 7 |
| 11 | detect_potential_problems | 1 |
| 12 | Entry points (actions + CLI) | 4 |
| 13 | Data graph | 3 |

**Total: ~88 ítems.** Tras cada fase, ejecutar `npm run test:coverage` y comprobar que el porcentaje sube y que no se introducen regresiones.

---

## Cómo usar este plan

1. Ir fase por fase en orden (0 → 13).
2. Dentro de cada fase, marcar cada ítem como hecho cuando los tests estén añadidos y pasen.
3. Opcional: mantener en el repo un checklist (por ejemplo en la descripción del issue o en un comentario) con [ ] / [x] por ítem.
4. Si un archivo es solo tipos/constantes y ya está cubierto al usarlo en otros tests, se puede marcar como "cubierto indirectamente" y cerrar el ítem.

Cuando todo esté cubierto según este plan, no debería quedar ningún archivo de `src/` sin cobertura asociada.

---

## Checklist rápido (marcar con [x])

```
Fase 0:  [ ] 0.1 [ ] 0.2 [ ] 0.3 [ ] 0.4 [ ] 0.5 [ ] 0.6
Fase 1:  [ ] 1.1 … [ ] 1.13
Fase 2:  [ ] 2.1 … [ ] 2.6
Fase 3:  [ ] 3.1 … [ ] 3.4
Fase 4:  [ ] 4.1 … [ ] 4.6
Fase 5:  [ ] 5.1 … [ ] 5.4
Fase 6:  [ ] 6.1 … [ ] 6.3
Fase 7:  [ ] 7.1 … [ ] 7.13
Fase 8:  [ ] 8.1 … [ ] 8.8
Fase 9:  [ ] 9.1 … [ ] 9.10
Fase 10: [ ] 10.1 … [ ] 10.7
Fase 11: [ ] 11.1
Fase 12: [ ] 12.1 … [ ] 12.4
Fase 13: [ ] 13.1 … [ ] 13.3
```
