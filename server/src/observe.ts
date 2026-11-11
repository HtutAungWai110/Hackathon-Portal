import { createObserveModule } from '@nestjs/observe';

// Arcjet freezes its client, so proxy based instrumentation breaks on its
// non-configurable methods. Register the client but leave it untraced.
function isArcjetClient(instance: unknown): boolean {
  if (typeof instance !== 'object' || instance === null) {
    return false;
  }

  return (
    Object.isFrozen(instance) && 'protect' in instance && 'withRule' in instance
  );
}

export const { ObserveModule, ObserveInstrument } = createObserveModule({
  skipInstrumentation: isArcjetClient,
});
