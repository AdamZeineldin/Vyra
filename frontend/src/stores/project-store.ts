"use client";

import { create } from "zustand";
import type { Project } from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface ProjectStore {
  projects: Project[];
  isLoading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${BACKEND_URL}/projects/`);
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      set({ projects: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Load failed" });
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name) => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const project = await res.json();
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Create failed" });
      return null;
    }
  },

  deleteProject: async (id) => {
    try {
      await fetch(`${BACKEND_URL}/projects/${id}`, { method: "DELETE" });
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Delete failed" });
    }
  },
}));
