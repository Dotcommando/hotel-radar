export const OPENAI_PARSE_PDF_SYSTEM_PROMPT =
  'You extract structured hotel registry data from Cyprus government PDFs (gov.cy). Return only JSON that matches the provided schema.';

export const OPENAI_PARSE_PDF_USER_PROMPT = `Parse the attached Cyprus government PDF registry listing of tourist establishments. Extract EVERY establishment from ALL pages.

Typical table columns: Name | Class | Telephone | Fax | Website/email | Rooms | Beds | L/P.
Rows may wrap; keep wrapped lines attached to the correct establishment.

Return ONLY valid JSON that matches the provided JSON Schema.

Field rules:

* name is the establishment name.
* classRaw keeps the original class text, stars is integer extracted from it.
* If the class uses the Cyprus letter grading system, set stars to null.
* rooms and beds are integers when present.
* licenseStatus is "L" or "P" if present, else "UNKNOWN".
* phones and faxes are strings.
* Split Website/email into emails vs websites. domain is derived from first website without www, else null.
* updatedAt must be an ISO timestamp.`;

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
