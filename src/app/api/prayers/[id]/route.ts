import { deletePrayer, getPrayer, isUniqueViolation, updatePrayer } from '@/lib/db/personal';
import { prayerUpdateSchema } from '@/lib/personal-validation';
import { ApiError, idResource, searchParam } from '@/lib/api';

export const { GET, PUT, DELETE } = idResource({
  path: '/api/prayers/[id]',
  noun: 'prayer',
  notFound: 'Prayer not found',
  get: getPrayer,
  update: updatePrayer,
  // DELETE takes the test flag as ?test=true, having no body.
  remove: (id, req) => deletePrayer(id, searchParam(req, 'test') === 'true'),
  schema: prayerUpdateSchema,
  mapError: (cause) => (isUniqueViolation(cause) ? new ApiError('That namaaz already exists', 409) : null),
});
