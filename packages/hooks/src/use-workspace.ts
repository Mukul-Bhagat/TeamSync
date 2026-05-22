import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@vistafam/database";
import { useWorkspaceStore } from "@vistafam/store";
import type { Workspace, CreateWorkspaceInput } from "@vistafam/types";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Workspace[];
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("workspaces")
        .insert({
          name: input.name,
          slug: input.slug,
          description: input.description,
          color: input.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Workspace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
