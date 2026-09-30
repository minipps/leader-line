// Type-checked by `npm run test:types`, through the package's own `exports` (CommonJS).
import LeaderLine = require('leader-line-plus');

const line = new LeaderLine(document.body, document.body, { path: 'grid' });
line.addEventListener('shown', (event) => {
  const effect: LeaderLine.ShowEffectName = event.detail.effect;
  void effect;
});
line.remove();
