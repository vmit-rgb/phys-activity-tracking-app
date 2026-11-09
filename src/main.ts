import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { DEFAULT_APPEARANCE, applyAppearance } from './ui/appearance';
import { VERSION_LABEL } from './version';

// Placeholder shell for the tooling stage; screens arrive in later pull requests.
applyAppearance(document.documentElement, DEFAULT_APPEARANCE);

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
