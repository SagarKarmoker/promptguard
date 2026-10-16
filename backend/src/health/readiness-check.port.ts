/** Port: a single readiness probe. `check()` throws when unhealthy. */
export interface ReadinessCheck {
  readonly name: string;
  check(): Promise<void>;
}

export const READINESS_CHECKS = Symbol('READINESS_CHECKS');
