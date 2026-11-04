// Pantalla Ajustes: exportar/importar/reiniciar progreso, preferencias.
import { getState, exportJSON, importJSON, resetProgress, setSetting, isPersistent, dayKey } from '../progress/store.js';

export function applySettings(settings = getState().settings) {
  document.documentElement.dataset.font = settings.fontSize === 'large' ? 'large' : 'normal';
}

export function renderAjustes(view) {
  const s = getState().settings;
  view.innerHTML = `
    <h1>Ajustes</h1>
    ${isPersistent() ? '' : '<div class="card notice"><p>Este navegador no permite guardar datos: el progreso se perderá al cerrar la página. Exporta antes de salir.</p></div>'}
    <section class="card">
      <h2>Tu progreso</h2>
      <p class="small muted">El progreso se guarda solo en este navegador. Para pasarlo a otro dispositivo, expórtalo aquí e impórtalo allá. Al importar se combinan ambos: por cada pregunta se conserva el registro con más intentos.</p>
      <div class="actions">
        <button type="button" class="btn" data-act="export">Exportar progreso</button>
        <label class="btn secondary file-btn">Importar progreso<input type="file" accept="application/json,.json" data-act="import"></label>
      </div>
      <p class="msg" role="status"></p>
    </section>
    <section class="card">
      <h2>Preferencias</h2>
      <label class="switch"><input type="checkbox" data-set="hideLikert" ${s.hideLikert ? 'checked' : ''}>
        <span>Ocultar la práctica de autoinforme (afirmaciones Likert sin puntaje). Las lecciones puntuadas de comportamentales e integridad siguen visibles.</span></label>
      <fieldset class="seg">
        <legend>Tamaño de letra</legend>
        <label><input type="radio" name="font" value="normal" ${s.fontSize !== 'large' ? 'checked' : ''}> Normal</label>
        <label><input type="radio" name="font" value="large" ${s.fontSize === 'large' ? 'checked' : ''}> Grande</label>
      </fieldset>
    </section>
    <section class="card">
      <h2>Reiniciar</h2>
      <p class="small muted">Borra todo el progreso de este navegador. Te recomendamos exportarlo antes.</p>
      <button type="button" class="btn secondary danger" data-act="reset">Reiniciar progreso</button>
    </section>`;

  const msg = view.querySelector('.msg');
  const say = (text, ok = true) => { msg.textContent = text; msg.className = `msg ${ok ? 'ok' : 'bad'}`; };

  view.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dian2676rc-progreso-${dayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('Archivo de progreso descargado.');
  });

  view.querySelector('[data-act="import"]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = importJSON(await file.text());
    e.target.value = '';
    if (err) say(`No se pudo importar: ${err}`, false);
    else say(`Progreso importado y combinado (${Object.keys(getState().items).length} ítems registrados).`);
  });

  view.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (!confirm('¿Seguro que quieres borrar todo tu progreso en este navegador? Esta acción no se puede deshacer.')) return;
    resetProgress();
    say('Progreso reiniciado.');
  });

  view.querySelector('[data-set="hideLikert"]').addEventListener('change', (e) => setSetting('hideLikert', e.target.checked));
  view.querySelectorAll('input[name="font"]').forEach((r) => r.addEventListener('change', () => {
    setSetting('fontSize', r.value);
    applySettings();
  }));
}
