import { deleteHealthTracking, getHealthTracking, updateHealthTracking } from '@/lib/db/personal';
import { validateHealthTrackingUpdate } from '@/lib/personal-validation';
import { idResource } from '@/lib/api';

export const { GET, PUT, DELETE } = idResource({
  path: '/api/health-tracking/[id]',
  noun: 'health tracking entry',
  notFound: 'Health tracking entry not found',
  get: getHealthTracking,
  update: updateHealthTracking,
  remove: deleteHealthTracking,
  parseUpdate: validateHealthTrackingUpdate,
});
