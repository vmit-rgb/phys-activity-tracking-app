import { wireAccordions } from '../ui/accordion';
import { pagesBarMarkup, wirePagesBar } from './bar';
import { FOOTER, part } from './parts';

/*
 * The two pages from the menu's help links (Figma, service map 2026-11-08):
 * screen/whats-new (391:9237) and screen/how-to-use (391:9276), both with the
 * bar variant `history` (≡ 🔍 ✕). Figma's «що нового» entries are placeholders
 * and only the first answer of «як користуватись» is written there: the rest
 * are Нитка's drafts (COPY.md).
 */

export interface HelpActions {
  /** ≡: back to the menu. */
  menu(): void;
  search(): void;
  /** ✕: home. */
  close(): void;
}

interface NewsEntry {
  readonly version: string;
  readonly changes: readonly string[];
}

/** Newest on top. */
const NEWS: readonly NewsEntry[] = [
  {
    version: 'бета 0.9 · 09.11.2026',
    changes: [
      'трекер тепер окремий застосунок: встановлюється на телефон і працює без інтернету',
      'записи зберігаються тільки на цьому телефоні. копію можна зберегти в меню',
      'можна відновити копію з бети 0.81 — нічого не загубиться',
      '«почати без ШІ»: приклади, з якими можна одразу спробувати',
      'рух записується колами, а повзунки мають −/+ і кнопку «зберегти»',
      'таймер для пульсу: рахуєш удари, а застосунок переводить в уд/хв',
      'у меню: що нового, як користуватись, поділитися',
      'історія: календар, середнє за місяць і всі записи по днях. і пошук у нотатках',
      'налаштування: тижнева ціль, фрази, колір, доступність, таймер для пульсу, копія, експорт і видалення',
      'експорт у PDF: записи чи вправи одним файлом, щоб роздрукувати або показати',
    ],
  },
];

const FAQ: readonly (readonly [question: string, answer: string])[] = [
  ['як відмітити вправу?', 'тапни на вправу — зʼявиться [x]. тапни ще раз, щоб зняти позначку. усе зберігається одразу.'],
  ['як записати день, який уже минув?', 'перейди на той день стрілками біля дати внизу або тапни на дату й вибери день у календарі. зверху буде написано, за який день запис.'],
  ['як змінити вправи, ціль чи колір?', 'меню → налаштування. тапни на текст, який хочеш змінити, а коли закінчиш — збережи внизу.'],
  ['навіщо зберігати копію?', 'записи живуть тільки на цьому телефоні. якщо телефон загубиться чи зламається, без копії вони зникнуть. копія — це файл: поклади його в хмару або надішли собі.'],
  ['як переїхати на новий телефон?', 'на старому: меню → «зберегти копію». перекинь файл на новий телефон, встанови там застосунок і на першому екрані натисни «відновити з копії».'],
  ['що означає * біля посилання?', 'таке посилання дав ШІ, коли складав налаштування. ми його не перевіряли: подивись, куди воно веде, перш ніж повторювати вправу.'],
  ['як збільшити текст чи вимкнути анімації?', 'у налаштуваннях, розділ «доступність»: там можна збільшити текст і зони тапу, вимкнути анімації та вібрацію.'],
];

function page(title: string, description: string, body: string): string {
  return `
    <div class="screen page">
      <section class="screen__section" aria-labelledby="page-title">
        <h1 id="page-title" class="t-h3">${title}</h1>
        <p class="t-2nd-regular muted">${description}</p>
      </section>
      ${body}
      ${FOOTER}
    </div>
    ${pagesBarMarkup()}`;
}

function show(host: HTMLElement, markup: string, actions: HelpActions): void {
  host.innerHTML = markup;
  wirePagesBar(host, actions);
}

const newsEntry = ({ version, changes }: NewsEntry) => `
  <article class="news__entry">
    <h2 class="t-2nd-bold">${version}</h2>
    <ul class="news__changes t-2nd-regular">${changes.map((change) => `<li>${change}</li>`).join('')}</ul>
  </article>`;

export function showWhatsNew(host: HTMLElement, actions: HelpActions): void {
  show(host, page('що нового', 'усі оновлення, найновіші зверху.', `
    <section class="screen__section news" aria-label="оновлення">${NEWS.map(newsEntry).join('')}</section>`), actions);
}

const faqItem = ([question, answer]: readonly [string, string], index: number) => `
  <div class="faq__item">
    <h2 class="faq__question">
      <button type="button" class="ctl accordion accordion--paragraph" aria-expanded="false" aria-controls="faq-${index}"><span class="accordion__title">${question}</span></button>
    </h2>
    <p class="t-2nd-regular" id="faq-${index}" hidden>${answer}</p>
  </div>`;

export function showHowToUse(host: HTMLElement, actions: HelpActions): void {
  show(host, page('як користуватись', 'коротко про те, що де лежить.', `
    <section class="screen__section faq" aria-label="питання">${FAQ.map(faqItem).join('')}</section>`), actions);
  wireAccordions(part(host, '.faq'));
}
