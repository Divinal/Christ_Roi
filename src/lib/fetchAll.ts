const PAGE_SIZE = 1000;

// PostgREST plafonne chaque réponse à 1000 lignes : au-delà, on enchaîne les
// pages pour ne pas sous-estimer silencieusement un total. La requête doit
// avoir un ordre stable.
export const fetchAllRows = async <T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};
