export interface ProfessionConfig {
  key: string;
  professionName: string;
  sector: string;
  enabledModules: string[];
  dashboardWidgets: string[];
  sidebarNavigation: Array<{ label: string; href: string; module?: string }>;
  onboardingQuestions: Array<{ id: string; label: string; type: 'text' | 'select' | 'boolean'; options?: string[] }>;
  defaultWorkflows: string[];
  kpiCards: string[];
  terminology: Record<string, string>;
}
