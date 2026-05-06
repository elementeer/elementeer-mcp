export type EnvironmentType = 'development' | 'staging' | 'production' | 'local';

const ENVIRONMENTS: Record<string, EnvironmentType[]> = {
  standard: ['local', 'development', 'staging', 'production'],
};

export function getAllEnvironments(workflow = 'standard'): EnvironmentType[] {
  return ENVIRONMENTS[workflow] || ENVIRONMENTS.standard;
}

export function getEnvironmentByType(type: EnvironmentType): { name: string; type: EnvironmentType } {
  return { name: type, type };
}

export function getPromotionWorkflow(): EnvironmentType[] {
  return ['development', 'staging', 'production'];
}

export function getNextEnvironment(current: EnvironmentType): EnvironmentType | null {
  const idx = getPromotionWorkflow().indexOf(current);
  return idx >= 0 && idx < getPromotionWorkflow().length - 1 ? getPromotionWorkflow()[idx + 1] : null;
}

export function getPreviousEnvironment(current: EnvironmentType): EnvironmentType | null {
  const idx = getPromotionWorkflow().indexOf(current);
  return idx > 0 ? getPromotionWorkflow()[idx - 1] : null;
}
