const ACTIVE_CANONICAL_HOTEL_ID = '69f88433878f7fca1f7e0cd8';
const DUPLICATE_CANONICAL_HOTEL_ID = '69f88433878f7fca1f7e0cda';
const GROUP_BUILD_RULE = 'known_property_complex_group';
const GROUP_CANONICAL_NAME = 'EVELEOS COUNTRY HOUSE';
const GROUP_MEMBER_NAMES = [
  'EVELEOS COUNTRY HOUSE A',
  'EVELEOS COUNTRY HOUSE B',
];
const MANUAL_RUN_ID = 'manual-data-fix-eveleos-country-house-merge';

function normalizeRegistryText(value) {
  if (value === null) {
    return '';
  }

  return value
    .normalize('NFKC')
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, ' AND ')
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/[/\\]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeAddressForCompare(value) {
  return normalizeRegistryText(value)
    .replace(/\bSTR\b/gu, 'STREET')
    .replace(/\bST\b/gu, 'STREET')
    .replace(/\bAVE\b/gu, 'AVENUE')
    .replace(/\bAV\b/gu, 'AVENUE');
}

function buildContactsKey(contacts) {
  return [
    contacts.domains.slice().sort().join(','),
    contacts.emails.slice().sort().join(','),
    contacts.phones.slice().sort().join(','),
    contacts.websites.slice().sort().join(','),
  ].join('|');
}

function mergeStringArrays(values) {
  return [...new Set(values.flat())].sort((left, right) =>
    left.localeCompare(right),
  );
}

function mergeContacts(entries) {
  return {
    domains: mergeStringArrays(entries.map(({ contacts }) => contacts.domains)),
    emails: mergeStringArrays(entries.map(({ contacts }) => contacts.emails)),
    phones: mergeStringArrays(entries.map(({ contacts }) => contacts.phones)),
    websites: mergeStringArrays(
      entries.map(({ contacts }) => contacts.websites),
    ),
  };
}

function sumNullableNumbers(values) {
  const knownValues = values.filter((value) => value !== null);

  return knownValues.length === 0
    ? null
    : knownValues.reduce((sum, value) => sum + value, 0);
}

function buildComponent(entry) {
  return {
    capacity: entry.capacity,
    componentKey: [
      'component-v1',
      entry.name.normalized,
      entry.establishmentType ?? '',
      entry.location.postcode ?? '',
      normalizeAddressForCompare(entry.location.address),
    ].join('|'),
    contacts: entry.contacts,
    establishmentType: entry.establishmentType,
    location: entry.location,
    name: entry.name.original,
    normalizedName: entry.name.normalized,
  };
}

function getLocationScore(location) {
  let score = 0;

  if (location.district !== null && location.locality !== null) {
    const normalizedDistrict = normalizeRegistryText(location.district);
    const normalizedLocality = normalizeRegistryText(location.locality);

    if (
      normalizedDistrict !== normalizedLocality &&
      normalizedDistrict.includes(normalizedLocality)
    ) {
      score += 10000;
    }

    if (
      normalizedDistrict !== normalizedLocality &&
      !normalizedDistrict.includes(normalizedLocality)
    ) {
      score += 100;
    }
  }

  if (location.postcode !== null) {
    score += 1000;
  }

  if (location.address !== null) {
    score += 100 + location.address.length;
  }

  if (location.locality !== null) {
    score += 10;
  }

  if (location.district !== null) {
    score += 1;
  }

  return score;
}

function findBestLocationEntry(entries) {
  return entries.slice().sort((left, right) => {
    const scoreCompare =
      getLocationScore(right.location) - getLocationScore(left.location);

    if (scoreCompare !== 0) {
      return scoreCompare;
    }

    return left.registryKey.localeCompare(right.registryKey);
  })[0];
}

function mergeLocation(bestEntry, entries) {
  return {
    address: bestEntry.location.address,
    district:
      bestEntry.location.district ??
      entries.find(({ location }) => location.district !== null)?.location
        .district ??
      null,
    locality:
      bestEntry.location.locality ??
      entries.find(({ location }) => location.locality !== null)?.location
        .locality ??
      null,
    postcode:
      bestEntry.location.postcode ??
      entries.find(({ location }) => location.postcode !== null)?.location
        .postcode ??
      null,
  };
}

function buildCandidateKey(entries, contacts) {
  const bestLocationEntry = findBestLocationEntry(entries);

  return [
    'ccv1',
    'group',
    GROUP_BUILD_RULE,
    GROUP_CANONICAL_NAME,
    bestLocationEntry.location.postcode ?? '',
    normalizeRegistryText(bestLocationEntry.location.address),
    buildContactsKey(contacts),
  ].join('|');
}

function buildCanonicalKey(location, contacts) {
  return [
    'chv1',
    'property_complex',
    GROUP_CANONICAL_NAME,
    normalizeRegistryText(location.district),
    normalizeRegistryText(location.locality),
    'location_contact',
    normalizeRegistryText(contacts.phones[0] ?? contacts.emails[0] ?? ''),
  ].join('|');
}

function buildWebPresence(contacts) {
  return {
    declaredWebsiteKind:
      contacts.websites.length > 0 ? 'own_website' : 'missing',
    domains: contacts.domains,
    hasDeclaredWebsite: contacts.websites.length > 0,
    issues: contacts.websites.length > 0 ? [] : ['missing_website'],
    source: 'gov_registry',
    websites: contacts.websites,
  };
}

function sortEntries(entries) {
  return entries.slice().sort((left, right) => {
    const leftIndex = GROUP_MEMBER_NAMES.indexOf(left.name.normalized);
    const rightIndex = GROUP_MEMBER_NAMES.indexOf(right.name.normalized);

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.registryKey.localeCompare(right.registryKey);
  });
}

async function applyMergeEveleosCountryHouseDataFix(db, options) {
  const now = options.now ?? new Date();
  const canonicalHotels = db.collection('canonical_hotels');
  const candidates = db.collection('canonical_hotel_candidates');
  const registryEntries = db.collection('hotel_registry_entries');
  const entries = sortEntries(
    await registryEntries
      .find({
        'name.normalized': {
          $in: GROUP_MEMBER_NAMES,
        },
      })
      .toArray(),
  );

  if (entries.length !== GROUP_MEMBER_NAMES.length) {
    throw new Error('EVELEOS registry entries are incomplete.');
  }

  const contacts = mergeContacts(entries);
  const location = mergeLocation(findBestLocationEntry(entries), entries);
  const candidateKey = buildCandidateKey(entries, contacts);
  const canonicalKey = buildCanonicalKey(location, contacts);
  const components = entries.map((entry) => buildComponent(entry));
  const groupedCandidateFields = {
    build: {
      issues: [],
      rule: GROUP_BUILD_RULE,
      ruleVersion: 1,
    },
    candidateKey,
    canonicalName: GROUP_CANONICAL_NAME,
    capacity: {
      beds: sumNullableNumbers(entries.map(({ capacity }) => capacity.beds)),
      mode: 'sum_components',
      rooms: sumNullableNumbers(entries.map(({ capacity }) => capacity.rooms)),
    },
    components,
    contacts,
    kind: 'property_complex',
    location,
    operator: null,
    processing: {
      action: 'updated',
      canonicalHotelId: options.ObjectId(ACTIVE_CANONICAL_HOTEL_ID),
      claimedAt: null,
      error: null,
      processedAt: now,
      review: null,
      runId: MANUAL_RUN_ID,
      status: 'processed',
    },
    status: 'ready',
    updatedAt: now,
  };
  const groupedCandidateResult = await candidates.updateOne(
    {
      candidateKey,
    },
    {
      $set: groupedCandidateFields,
      $setOnInsert: {
        createdAt: now,
      },
    },
    {
      upsert: true,
    },
  );
  const groupedCandidate = await candidates.findOne({
    candidateKey,
  });

  if (groupedCandidate === null) {
    throw new Error('Failed to upsert EVELEOS grouped candidate.');
  }

  const registryResult = await registryEntries.updateMany(
    {
      _id: {
        $in: entries.map(({ _id }) => _id),
      },
    },
    {
      $set: {
        'processing.canonicalHotelCandidateId': groupedCandidate._id,
        'processing.claimedAt': null,
        'processing.error': null,
        'processing.processedAt': now,
        'processing.runId': MANUAL_RUN_ID,
        'processing.status': 'processed',
      },
    },
  );
  const activeResult = await canonicalHotels.updateOne(
    {
      _id: options.ObjectId(ACTIVE_CANONICAL_HOTEL_ID),
    },
    {
      $set: {
        canonicalKey,
        canonicalName: GROUP_CANONICAL_NAME,
        capacity: groupedCandidateFields.capacity,
        components,
        contacts,
        kind: 'property_complex',
        lastSeenAt: now,
        location,
        operator: null,
        source: {
          lastCandidateBuildRule: GROUP_BUILD_RULE,
          lastCandidateBuildRuleVersion: 1,
          lastCandidateKey: candidateKey,
          lastCandidateSeenAt: now,
          origin: 'gov_registry',
        },
        updatedAt: now,
        webPresence: buildWebPresence(contacts),
      },
    },
  );
  const duplicateResult = await canonicalHotels.updateOne(
    {
      _id: options.ObjectId(DUPLICATE_CANONICAL_HOTEL_ID),
    },
    {
      $set: {
        status: 'duplicate',
        updatedAt: now,
      },
    },
  );
  const obsoleteCandidateKeys = entries.map(
    ({ registryKey }) => `ccv1|single|${registryKey}`,
  );
  const obsoleteCandidatesResult = await candidates.deleteMany({
    candidateKey: {
      $in: obsoleteCandidateKeys,
    },
  });

  return {
    canonicalHotels: {
      activeMatched: activeResult.matchedCount,
      activeModified: activeResult.modifiedCount,
      duplicateMatched: duplicateResult.matchedCount,
      duplicateModified: duplicateResult.modifiedCount,
    },
    canonicalHotelCandidates: {
      groupedId: groupedCandidate._id.toString(),
      groupedMatched: groupedCandidateResult.matchedCount,
      groupedModified: groupedCandidateResult.modifiedCount,
      groupedUpserted:
        groupedCandidateResult.upsertedCount === 1 ||
        (groupedCandidateResult.upsertedId !== undefined &&
          groupedCandidateResult.upsertedId !== null),
      obsoleteDeleted: obsoleteCandidatesResult.deletedCount ?? 0,
    },
    hotelRegistryEntries: {
      matched: registryResult.matchedCount,
      modified: registryResult.modifiedCount,
    },
    ok: true,
  };
}

module.exports = {
  applyMergeEveleosCountryHouseDataFix,
};
