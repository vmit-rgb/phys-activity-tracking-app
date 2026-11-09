import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { DEFAULT_APPEARANCE, startAppearance } from './ui/appearance';
import { trackInputModality } from './ui/modality';
import { VERSION_LABEL } from './version';

// Placeholder shell for the tooling stage; screens arrive in later pull requests.
const root = document.documentElement;
startAppearance(root, matchMedia('(prefers-color-scheme: light)'), DEFAULT_APPEARANCE);
trackInputModality(root);

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  app.innerHTML = `
    <section class="shell">
      <p class="shell__logo" aria-hidden="true">(ง•_•)ง</p>
      <h1 class="shell__title">${VERSION_LABEL} у розробці</h1>
    </section>
    <footer class="footer">
      <p>(Олеся + Нитка / AI)</p>
      <p class="footer__muted">${VERSION_LABEL}</p>
      <p class="footer__muted">© 2026 Олеся Кіштанова · усі права захищено</p>
    </footer>
    <div class="noise" aria-hidden="true"></div>`;
}
