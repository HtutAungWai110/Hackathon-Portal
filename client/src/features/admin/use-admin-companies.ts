import { useQuery } from '@tanstack/react-query';
import { adminCompanyKeys, listAdminCompanies } from './events-api';

/**
 * Companies change rarely, so the picker can reuse one read for the whole
 * session instead of refetching whenever the form opens.
 */
export function useAdminCompanies() {
  return useQuery({
    queryKey: adminCompanyKeys.all,
    queryFn: listAdminCompanies,
    staleTime: 5 * 60_000,
  });
}
