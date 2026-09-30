// Type-checked by `npm run test:types`, through the package's own `exports` (ES module).
import LeaderLine from 'leader-line-plus';

const start = document.createElement('div');
const end = document.createElement('div');

const options: LeaderLine.Options = { color: '#afafaf', size: 3, startPlug: 'disc', endPlug: 'behind', dash: true };
const line = new LeaderLine(LeaderLine.pointAnchor(start, { x: '55%', y: '78%' }), end, options);
line.startSocketGravity = 80;
line.startSocketGravity = [192, -172];
line.position().setOptions({ outline: true, outlineSize: 0.06 });
new LeaderLine({ start, end: LeaderLine.areaAnchor(end, 'circle', { color: 'red' }), hide: true });
LeaderLine.positionByWindowResize = false;
line.autoPosition = true;
line.flow = { speed: 120, reverse: true };
line.smoothPosition = { duration: 200, timing: [0.4, 0, 0.2, 1] };
line.setOptions({ smoothPosition: true, flow: true });
LeaderLine.reducedMotion = 'auto';
LeaderLine.reducedMotion = true;
// @ts-expect-error: not a setting
LeaderLine.reducedMotion = 'never';
const watched: boolean = line.autoPosition;
void watched;

line.addEventListener('update', (event) => {
  const changed: LeaderLine.UpdatedPart[] = event.detail.changed;
  const self: LeaderLine = event.detail.line;
  void [changed, self];
});
line.addEventListener('show', (event) => {
  const effect: LeaderLine.ShowEffectName = event.detail.effect;
  void effect;
});
LeaderLine.addEventListener('position', (event) => event.detail.line.remove());

// @ts-expect-error: not a socket
new LeaderLine(start, end, { startSocket: 'middle' });
// @ts-expect-error: not an event
line.addEventListener('moved', () => {});
line.remove();
