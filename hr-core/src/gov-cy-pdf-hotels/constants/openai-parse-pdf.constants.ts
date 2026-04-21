export const OPENAI_PARSE_PDF_JSON_SCHEMA = {
  additionalProperties: false,
  properties: {
    hotels: {
      items: {
        additionalProperties: false,
        properties: {
          address: {
            type: ['string', 'null'],
          },
          beds: {
            type: ['integer', 'null'],
          },
          classRaw: {
            type: ['string', 'null'],
          },
          contacts: {
            additionalProperties: false,
            properties: {
              domain: {
                type: ['string', 'null'],
              },
              emails: {
                items: {
                  type: 'string',
                },
                type: 'array',
              },
              faxes: {
                items: {
                  type: 'string',
                },
                type: 'array',
              },
              phones: {
                items: {
                  type: 'string',
                },
                type: 'array',
              },
              websites: {
                items: {
                  type: 'string',
                },
                type: 'array',
              },
            },
            required: ['phones', 'faxes', 'emails', 'websites', 'domain'],
            type: 'object',
          },
          establishmentType: {
            type: ['string', 'null'],
          },
          licenseStatus: {
            enum: ['L', 'P', 'UNKNOWN'],
            type: 'string',
          },
          locality: {
            type: ['string', 'null'],
          },
          managerName: {
            type: ['string', 'null'],
          },
          name: {
            type: 'string',
          },
          nameNormalized: {
            type: 'string',
          },
          operatorName: {
            type: ['string', 'null'],
          },
          postcode: {
            type: ['string', 'null'],
          },
          region: {
            type: ['string', 'null'],
          },
          rooms: {
            type: ['integer', 'null'],
          },
          stars: {
            type: ['integer', 'null'],
          },
          updatedAt: {
            format: 'date-time',
            type: 'string',
          },
        },
        required: [
          'name',
          'nameNormalized',
          'region',
          'locality',
          'address',
          'postcode',
          'contacts',
          'establishmentType',
          'classRaw',
          'stars',
          'rooms',
          'beds',
          'operatorName',
          'managerName',
          'licenseStatus',
          'updatedAt',
        ],
        type: 'object',
      },
      type: 'array',
    },
  },
  required: ['hotels'],
  type: 'object',
};
