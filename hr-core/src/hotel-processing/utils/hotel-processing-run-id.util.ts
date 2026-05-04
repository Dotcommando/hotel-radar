const HOTEL_PROCESSING_RUN_ID_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-/u;

export function findLatestHotelProcessingRunId(
  runIds: (string | null)[],
): string | null {
  let latestRunId: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const runId of runIds) {
    if (runId === null) {
      continue;
    }

    const time = parseHotelProcessingRunIdTime(runId);

    if (time === null || time <= latestTime) {
      continue;
    }

    latestRunId = runId;
    latestTime = time;
  }

  return latestRunId;
}

export function isHotelProcessingRunIdSameOrAfter(
  leftRunId: string,
  rightRunId: string,
): boolean {
  const leftTime = parseHotelProcessingRunIdTime(leftRunId);
  const rightTime = parseHotelProcessingRunIdTime(rightRunId);

  return leftTime !== null && rightTime !== null && leftTime >= rightTime;
}

function parseHotelProcessingRunIdTime(runId: string): number | null {
  const match = runId.match(HOTEL_PROCESSING_RUN_ID_DATE_PATTERN);

  if (match === null) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const time = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (!Number.isFinite(time)) {
    return null;
  }

  return time;
}
