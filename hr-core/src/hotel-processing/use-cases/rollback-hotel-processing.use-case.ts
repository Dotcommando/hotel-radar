import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CanonicalHotelCandidatesService } from '../../canonical-hotel-candidates/canonical-hotel-candidates.service';
import { HotelRegistryEntriesService } from '../../hotel-registry-entries/hotel-registry-entries.service';
import { RawHotelsService } from '../../raw-hotels/raw-hotels.service';
import { HOTEL_PROCESSING_BATCH_SIZE } from '../constants/hotel-processing-defaults.constant';
import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from '../constants/hotel-processing-rollback-target-stage.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HotelProcessingNoRollbackRunFoundError } from '../errors/hotel-processing-no-rollback-run-found.error';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HotelProcessingRunsService } from '../hotel-processing-runs.service';
import {
  IHotelProcessingRollbackResult,
  IHotelProcessingRollbackStepResult,
} from '../types/hotel-processing-rollback-result.interface';
import {
  findLatestHotelProcessingRunId,
  isHotelProcessingRunIdSameOrAfter,
} from '../utils/hotel-processing-run-id.util';

@Injectable()
export class RollbackHotelProcessingUseCase {
  constructor(
    private readonly rawHotelsService: RawHotelsService,
    private readonly hotelRegistryEntriesService: HotelRegistryEntriesService,
    private readonly canonicalHotelCandidatesService: CanonicalHotelCandidatesService,
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
  ) {}

  async execute(
    targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE,
  ): Promise<IHotelProcessingRollbackResult> {
    await this.assertNoActiveRuns();

    if (targetStage === HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1) {
      const steps = await this.rollbackToStage1();

      return {
        ok: true,
        steps,
        targetStage,
      };
    }

    return {
      ok: true,
      steps: [await this.rollbackRegistryToCandidates()],
      targetStage,
    };
  }

  private async assertNoActiveRuns(): Promise<void> {
    const stages = [
      HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
    ];

    for (const stage of stages) {
      const hasActiveRun =
        await this.hotelProcessingRunsService.hasActiveRun(stage);

      if (hasActiveRun) {
        throw new HotelProcessingActiveRunExistsError();
      }
    }
  }

  private async rollbackRegistryToCandidates(): Promise<IHotelProcessingRollbackStepResult> {
    const runId = findLatestHotelProcessingRunId(
      await this.hotelRegistryEntriesService.findProcessingRunIds(),
    );

    if (runId === null) {
      throw new HotelProcessingNoRollbackRunFoundError(
        HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      );
    }

    return this.rollbackRegistryToCandidatesRun(runId);
  }

  private async rollbackToStage1(): Promise<
    IHotelProcessingRollbackStepResult[]
  > {
    const rawToRegistryRunId = findLatestHotelProcessingRunId(
      await this.rawHotelsService.findProcessingRunIds(),
    );

    if (rawToRegistryRunId === null) {
      throw new HotelProcessingNoRollbackRunFoundError(
        HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      );
    }

    const steps: IHotelProcessingRollbackStepResult[] = [];
    const registryToCandidatesRunId = findLatestHotelProcessingRunId(
      await this.hotelRegistryEntriesService.findProcessingRunIds(),
    );

    if (
      registryToCandidatesRunId !== null &&
      isHotelProcessingRunIdSameOrAfter(
        registryToCandidatesRunId,
        rawToRegistryRunId,
      )
    ) {
      steps.push(
        await this.rollbackRegistryToCandidatesRun(registryToCandidatesRunId),
      );
    }

    steps.push(await this.rollbackRawToRegistryRun(rawToRegistryRunId));

    return steps;
  }

  private async rollbackRegistryToCandidatesRun(
    runId: string,
  ): Promise<IHotelProcessingRollbackStepResult> {
    const total =
      await this.hotelRegistryEntriesService.countByProcessingRunId(runId);
    let resetSourceDocuments = 0;
    let deletedTargetDocuments = 0;

    for (
      let processedDocuments = 0;
      processedDocuments < total;
      processedDocuments += HOTEL_PROCESSING_BATCH_SIZE
    ) {
      const batch =
        await this.hotelRegistryEntriesService.readRollbackBatchByProcessingRunId(
          runId,
          HOTEL_PROCESSING_BATCH_SIZE,
        );

      if (batch.length === 0) {
        throw new Error(
          `Rollback registry_to_candidates batch is empty before ${total} documents were processed.`,
        );
      }

      const registryEntryIds = batch.map(({ _id }) => _id);
      const candidateIds = this.uniqueObjectIds(
        batch
          .map(({ processing }) => processing.canonicalHotelCandidateId)
          .filter((candidateId) => candidateId !== null),
      );

      resetSourceDocuments +=
        await this.hotelRegistryEntriesService.resetProcessingByIds(
          registryEntryIds,
        );
      deletedTargetDocuments +=
        await this.canonicalHotelCandidatesService.deleteManyByIds(
          candidateIds,
        );
    }

    return {
      deletedTargetDocuments,
      resetSourceDocuments,
      runId,
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    };
  }

  private async rollbackRawToRegistry(): Promise<IHotelProcessingRollbackStepResult> {
    const runId = findLatestHotelProcessingRunId(
      await this.rawHotelsService.findProcessingRunIds(),
    );

    if (runId === null) {
      throw new HotelProcessingNoRollbackRunFoundError(
        HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      );
    }

    return this.rollbackRawToRegistryRun(runId);
  }

  private async rollbackRawToRegistryRun(
    runId: string,
  ): Promise<IHotelProcessingRollbackStepResult> {
    const total = await this.rawHotelsService.countByProcessingRunId(runId);
    let resetSourceDocuments = 0;
    let deletedTargetDocuments = 0;

    for (
      let processedDocuments = 0;
      processedDocuments < total;
      processedDocuments += HOTEL_PROCESSING_BATCH_SIZE
    ) {
      const batch =
        await this.rawHotelsService.readRollbackBatchByProcessingRunId(
          runId,
          HOTEL_PROCESSING_BATCH_SIZE,
        );

      if (batch.length === 0) {
        throw new Error(
          `Rollback raw_to_registry batch is empty before ${total} documents were processed.`,
        );
      }

      const rawHotelIds = batch.map(({ _id }) => _id);
      const registryEntryIds = this.uniqueObjectIds(
        batch
          .map(({ processing }) => processing.hotelRegistryEntryId)
          .filter((registryEntryId) => registryEntryId !== null),
      );

      resetSourceDocuments +=
        await this.rawHotelsService.resetProcessingByIds(rawHotelIds);
      deletedTargetDocuments +=
        await this.hotelRegistryEntriesService.deleteManyByIds(
          registryEntryIds,
        );
    }

    return {
      deletedTargetDocuments,
      resetSourceDocuments,
      runId,
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
    };
  }

  private uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
    const idMap = new Map<string, Types.ObjectId>();

    for (const id of ids) {
      idMap.set(id.toString(), id);
    }

    return [...idMap.values()];
  }
}
