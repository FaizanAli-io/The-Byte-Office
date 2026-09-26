import { deletePrayer, getPrayer, isUniqueViolation, updatePrayer } from '@/lib/db/personal';
import { validatePrayerUpdate } from '@/lib/personal-validation';
import { ApiError, idResource } from '@/lib/api';

export const { GET, PUT, DELETE } = idResource({
  path: '/api/prayers/[id]',
  noun: 'prayer',
  notFound: 'Prayer not found',
  get: getPrayer,
  update: updatePrayer,
  remove: deletePrayer,
  parseUpdate: validatePrayerUpdate,
  mapError: (cause) => (isUniqueViolation(cause) ? new ApiError('That namaaz already exists', 409) : null),
});
