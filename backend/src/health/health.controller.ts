import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { READINESS_CHECKS } from './readiness-check.port.js';
import type { ReadinessCheck } from './readiness-check.port.js';

interface CheckResult {
  readonly name: string;
  readonly status: 'ok' | 'down';
  readonly error?: string;
}

@Controller()
export class HealthController {
  constructor(
    @Inject(READINESS_CHECKS) private readonly checks: readonly ReadinessCheck[],
  ) {}

  @Get('health')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async readiness(@Res() res: Response): Promise<void> {
    const results: CheckResult[] = [];
    for (const check of this.checks) {
      try {
        await check.check();
        results.push({ name: check.name, status: 'ok' });
      } catch (error) {
        results.push({
          name: check.name,
          status: 'down',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const hasDown = results.some((result) => result.status === 'down');
    res.status(hasDown ? 503 : 200).json({
      status: hasDown ? 'down' : 'ok',
      checks: results,
    });
  }
}
