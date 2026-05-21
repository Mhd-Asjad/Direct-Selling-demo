import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });

  const isAuthenticated = !!user && !error;
  const isAdmin = user?.role === "admin";

  return { user, isLoading, isAuthenticated, isAdmin };
}
