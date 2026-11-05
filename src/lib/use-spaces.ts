import { useQuery } from "@tanstack/react-query";
import { backend } from "@/lib/backend";
import { sellerPanelLabel, spaces } from "@/lib/roles";
import { keys, useUser } from "@/lib/session";

/** Menú de la persona: si vende, si promociona como afiliado y cómo se llama su panel. */
export function useSpaces() {
  const { user } = useUser();
  const store = useQuery({
    queryKey: keys.myStore,
    queryFn: () => backend.myStore(),
    enabled: !!user,
  });
  const s = spaces(user?.accountType, !!store.data, !!user?.username);
  return {
    user,
    ...s,
    hasStore: !!store.data,
    sellerLabel: sellerPanelLabel(user?.accountType, store.data?.kind),
  };
}
