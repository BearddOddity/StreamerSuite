import type { ComponentType } from "react";

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "chat" | "tools" | "alerts" | "media" | "utilities";
  component: ComponentType;
  featured?: boolean;
}

const apps: AppDefinition[] = [];

export function registerApp(app: AppDefinition) {
  apps.push(app);
}

export function getApps(): AppDefinition[] {
  return [...apps];
}

export function getApp(id: string): AppDefinition | undefined {
  return apps.find((a) => a.id === id);
}

export function getFeaturedApps(): AppDefinition[] {
  return apps.filter((a) => a.featured);
}

export function getAppsByCategory(category: string): AppDefinition[] {
  return apps.filter((a) => a.category === category);
}
