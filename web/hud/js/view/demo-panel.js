/** Hidden buttons to fire every alert and move through the walk during a demo. Long-press the screen to show it. */
export function createDemoPanel({ element, app, renderer, live }) {
  const actions = [
    ['Oxygen ×20', () => app.demo.oxygenFast()],
    ['Oxygen 25%', () => app.demo.oxygenLow()],
    ['Steep ground', () => app.demo.steepGround()],
    ['Next stop (sim)', () => app.demo.nextStop()],
    ['Ground Control message', () => (live.pushMessage ? live.pushMessage('Copy, looking good. Keep to the route.') : app.demo.message('Test message'))],
    ['VR / hand-held', () => renderer.setView(renderer.view === 'vr' ? 'single' : 'vr')],
    ['Hide', () => { element.hidden = true; }],
  ];
  element.replaceChildren(...actions.map(([label, run]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      run();
    });
    return button;
  }));
  return {
    toggle() {
      element.hidden = !element.hidden;
    },
    show() {
      element.hidden = false;
    },
  };
}
