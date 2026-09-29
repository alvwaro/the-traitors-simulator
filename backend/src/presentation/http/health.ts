import { Router } from 'express';

/**
 * Situação do processo para o balanceador de carga. Ao desligar (deploy, redução de instâncias), o processo
 * avisa que está saindo: a checagem de prontidão responde 503 e o balanceador para de mandar requisições novas
 * enquanto as que estão em andamento terminam.
 */
export class Lifecycle {
  private draining = false;

  startDraining(): void {
    this.draining = true;
  }

  get isDraining(): boolean {
    return this.draining;
  }
}

/**
 * /health e /health/live: o processo está de pé (liveness).
 * /health/ready: pode receber tráfego — o banco responde e o processo não está desligando (readiness).
 */
export function healthRouter(lifecycle: Lifecycle, pingDatabase: () => Promise<void>): Router {
  const router = Router();
  router.get(['/health', '/health/live'], (_req, res) => {
    res.json({ ok: true });
  });
  router.get('/health/ready', async (_req, res) => {
    if (lifecycle.isDraining) {
      res.status(503).json({ ok: false, reason: 'draining' });
      return;
    }
    try {
      await pingDatabase();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, reason: 'database' });
    }
  });
  return router;
}
