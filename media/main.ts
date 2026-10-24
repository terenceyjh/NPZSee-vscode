// SPDX-License-Identifier: GPL-3.0-or-later
// The webview renders bounded responses; all array access and analysis run in Rust.
import { t, setLanguage, getLanguage, resolveLanguage, languages, formatNumber, type Language } from '../src/i18n';
type Range = [
    number,
    number
];
type Point = [
    number | null,
    number | null
];
type Entry = {
    index: number;
    name: string;
    bytes: number;
    compressedBytes: number;
};
type Meta = {
    name: string;
    shape: number[];
    dtype: string;
    kind: string;
    numeric: boolean;
    text: boolean;
    count: number;
    bytes: number;
    fortran: boolean;
    cached: boolean;
    elapsedMs: number;
};
type Tab = 'Table' | 'Plot' | 'Histogram';
type Preferences = {
    name?: string;
    prefix: number[];
    tab: Tab;
    page: number;
    colPage: number;
    pageSize: number;
    component: string;
    layout: string;
    row: number;
    bins: number;
    exact: boolean;
    filter: string;
    logX: boolean;
    logY: boolean;
    language?: Language;
};
declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): Partial<Preferences> | undefined;
    setState(value: Preferences): void;
};
const vscode = acquireVsCodeApi();
const pref: Preferences = { prefix: [], tab: 'Table', page: 0, colPage: 0, pageSize: 100, component: 'real', layout: 'row', row: 0, bins: 64, exact: false, filter: '', logX: false, logY: false, ...vscode.getState() };
const bootstrap = (window as unknown as {
    NPZSEE_BOOTSTRAP?: {
        language: string;
    };
}).NPZSEE_BOOTSTRAP;
setLanguage(resolveLanguage(bootstrap?.language ?? pref.language ?? navigator.language));
pref.language = getLanguage();
let details: {
    value: string;
    truncated: boolean;
    indices: number[];
    array: number;
} | undefined;
let entries: Entry[] = [];
let selected: number | undefined;
let meta: Meta | undefined;
let epoch = 0;
// Hidden webviews may be recreated while old host responses are still in flight.
const sessionWords = crypto.getRandomValues(new Uint32Array(2));
let requestId = sessionWords[0] * 2 ** 20 + (sessionWords[1] & 0xfffff);
let busy = false;
let stale = false;
let chart: Chart | undefined;
const pending = new Map<number, {
    resolve(value: any): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
}>();
function rpc(method: string, params: object = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = ++requestId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(t('Operation timed out. Reload the file to reconnect.'))); }, 125000);
        pending.set(id, { resolve, reject, timer });
        vscode.postMessage({ type: 'request', id, method, params });
    });
}
function save() { vscode.setState(pref); }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}
function button(text: string, action: () => void, title = ''): HTMLButtonElement {
    const node = el('button', '', text);
    node.type = 'button';
    node.title = title;
    node.addEventListener('click', action);
    return node;
}
function formatBytes(bytes: number): string { return bytes >= 2 ** 30 ? `${(bytes / 2 ** 30).toFixed(2)} GiB` : bytes >= 2 ** 20 ? `${(bytes / 2 ** 20).toFixed(1)} MiB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} B`; }
const shapeText = (shape: number[]) => shape.length ? `(${shape.join(', ')}${shape.length === 1 ? ',' : ''})` : t('scalar');
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function status(text: string, loading = false) { statusNode.textContent = text; busy = loading; cancelButton.hidden = !loading; statusNode.classList.toggle('busy', loading); }
function showError(error: unknown) {
    chart?.dispose();
    chart = undefined;
    content.replaceChildren();
    hideDetails();
    const code = (error as {
        code?: string;
    })?.code;
    const keys: Record<string, string> = {
        OBJECT: 'Object arrays use pickle and cannot be opened safely. Save metadata as text or JSON instead.',
        INVALID_FILE: 'The file is invalid, incomplete or damaged. Check that writing has finished, then reload.',
        IO: 'The file could not be read. Check its location, permissions and available temporary disk space.',
        RANGE: 'The requested data range is invalid. Select the array again.',
        NONFINITE: 'No finite numeric values are available to plot.',
        EMPTY: 'Empty array · {shape}',
        SLICE: 'Open a 1D or 2D slice in Table before plotting.',
        NUMERIC: 'This array contains text or an unsupported numeric type. Use Table to inspect its values.',
        CANCELLED: 'Operation cancelled. Select an array or view to continue.',
    };
    const message = code ? t(keys[code] ?? 'The data engine is unavailable. Reload the file to reconnect.', { shape: meta ? shapeText(meta.shape.slice(pref.prefix.length)) : '' }) : errorText(error);
    const box = el('div', 'empty-state error-state');
    box.append(el('div', 'empty-icon', '!'), el('h2', '', t('Unable to show this view')), el('p', '', message));
    if (code) {
        const technical = el('details', 'technical-details');
        technical.append(el('summary', '', t('Technical details')), el('pre', '', errorText(error)));
        box.append(technical);
    }
    content.append(box);
    status(t('Ready'));
}
function baseParams(): object { return { array: selected, prefix: [...pref.prefix], component: pref.component }; }
function stopPrevious() { void rpc('cancel').catch(() => { }); }
const app = document.getElementById('app')!;
app.innerHTML = `<div class="shell">
  <aside class="sidebar" data-i18n-aria="Arrays"><div class="brand"><span class="brand-mark">N</span><div><strong>NPZSee</strong><span data-i18n="NUMPY ARRAYS"></span></div></div>
  <div class="language-control"><label for="language" data-i18n="Language"></label><select id="language" data-i18n-aria="Language"></select></div>
  <div class="sidebar-heading"><span data-i18n="ARRAYS"></span><span id="array-count" class="badge">0</span></div>
  <input id="filter" type="search" data-i18n-placeholder="Filter arrays…" data-i18n-aria="Filter arrays">
  <div id="array-list" role="list" class="array-list"></div><div class="sidebar-foot" data-i18n="Read only · Files stay local"></div></aside>
  <main class="main"><header class="header"><div class="file-heading"><div><h1 id="array-title"></h1><div id="metadata" class="metadata"></div></div><button id="reload" data-i18n="Reload" data-i18n-title="Reload the file from disk"></button></div>
  <div id="changed" class="notice" hidden data-i18n="The file changed on disk. Reload to view the latest data."></div>
  <nav id="tabs" class="tabs" data-i18n-aria="Data views"></nav><nav id="breadcrumbs" class="breadcrumbs" data-i18n-aria="Array slice"></nav></header>
  <div id="controls" class="controls"></div><div class="view-body">
  <aside id="cell-details" class="cell-details" hidden role="region" data-i18n-aria="Cell details"><div class="details-header"><strong data-i18n="Cell details"></strong><button id="close-details" data-i18n-title="Close details" data-i18n-aria="Close details">✕</button></div><div id="cell-location" class="cell-location"></div><button id="copy-cell" data-i18n="Copy value"></button><p id="cell-notice" class="warning" hidden data-i18n="Preview limited to 2 million characters"></p><pre id="cell-value" tabindex="0" dir="auto"></pre><p class="details-hint" data-i18n="Select another cell to update this panel."></p></aside>
  <section id="content" class="content" aria-live="polite"></section></div>
  <footer><span id="status" role="status"></span><button id="cancel" hidden data-i18n="Cancel"></button><span class="footer-hint" data-i18n="Original file stays unchanged"></span></footer></main></div>`;
const $ = (id: string) => document.getElementById(id)!;
const content = $('content');
const controls = $('controls');
const list = $('array-list');
const statusNode = $('status');
const cancelButton = $('cancel') as HTMLButtonElement;
const filter = $('filter') as HTMLInputElement;
const languageSelect = $('language') as HTMLSelectElement;
for (const language of languages) {
    const option = el('option', '', language.label);
    option.value = language.value;
    languageSelect.append(option);
}
function localizeShell() {
    document.documentElement.lang = getLanguage();
    document.documentElement.dir = getLanguage() === 'ar' ? 'rtl' : 'ltr';
    languageSelect.value = getLanguage();
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => node.textContent = t(node.dataset.i18n!));
    for (const [attribute, data] of [['placeholder', 'i18nPlaceholder'], ['aria-label', 'i18nAria'], ['title', 'i18nTitle']]) {
        document.querySelectorAll<HTMLElement>(`[data-${data.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}]`).forEach(node => node.setAttribute(attribute, t(node.dataset[data]!)));
    }
}
function applyLanguage(value: string, notify = true) {
    const language = resolveLanguage(value);
    setLanguage(language);
    pref.language = language;
    save();
    localizeShell();
    if (notify)
        vscode.postMessage({ type: 'setLanguage', language });
    if(selected!==undefined) void selectArray(selected,true);
    else { renderHeader(); renderList(); renderWelcome(); }
}
languageSelect.addEventListener('change', () => applyLanguage(languageSelect.value));
localizeShell();
filter.value = pref.filter;
filter.addEventListener('input', () => { pref.filter = filter.value; save(); renderList(); });
$('reload').addEventListener('click', () => void openFile(true));
cancelButton.addEventListener('click', () => { ++epoch; stopPrevious(); status(t('Operation cancelled. Select an array or view to continue.')); });
function hideDetails(clear = false) {
    $('cell-details').hidden = true;
    if (clear)
        details = undefined;
    document.querySelectorAll('.selected-cell').forEach(node => node.classList.remove('selected-cell'));
}
function renderDetails() {
    if (!details || details.array !== selected || pref.tab !== 'Table') {
        hideDetails();
        return;
    }
    $('cell-details').hidden = false;
    $('cell-value').textContent = details.value;
    $('cell-notice').hidden = !details.truncated;
    $('cell-location').textContent = `${meta?.name ?? ''} [${details.indices.join(', ')}]`;
    document.querySelectorAll<HTMLElement>('.cell').forEach(node => node.classList.toggle('selected-cell', node.dataset.indices === JSON.stringify(details!.indices)));
}
$('close-details').addEventListener('click', () => hideDetails(true));
$('copy-cell').addEventListener('click', () => vscode.postMessage({ type: 'copy', text: details?.value ?? '' }));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('cell-details').hidden)
        hideDetails(true);
});
function renderList() {
    list.replaceChildren();
    const visible = entries.filter(e => e.name.toLocaleLowerCase().includes(pref.filter.toLocaleLowerCase()));
    $('array-count').textContent = `${visible.length}/${entries.length}`;
    for (const entry of visible) {
        const node = button('', () => void selectArray(entry.index));
        node.className = `array-item${selected === entry.index ? ' selected' : ''}`;
        node.dataset.index = String(entry.index);
        node.setAttribute('role', 'listitem');
        node.setAttribute('aria-current', selected === entry.index ? 'true' : 'false');
        node.title = entry.name;
        node.append(el('span', 'array-name', entry.name), el('span', 'array-size', formatBytes(entry.bytes)));
        list.append(node);
    }
    if (!visible.length)
        list.append(el('p', 'muted', t(entries.length ? 'No matching arrays' : 'No arrays')));
}
function renderHeader() {
    $('array-title').textContent = meta?.name ?? (selected !== undefined ? entries[selected]?.name ?? 'Array' : t('Explore your arrays'));
    $('metadata').replaceChildren();
    if (meta) {
        for (const text of [shapeText(meta.shape), meta.dtype, formatBytes(meta.bytes), t(meta.fortran ? 'Fortran order' : 'C order')])
            $('metadata').append(el('span', 'metadata-chip', text));
    }
    else
        $('metadata').textContent = t(selected === undefined ? 'Select an array to begin' : 'Loading array…');
    $('tabs').replaceChildren();
    for (const tab of ['Table', 'Plot', 'Histogram'] as Tab[]) {
        const node = button(t(tab), () => {
            pref.tab = tab;
            save();
            const current = ++epoch;
            stopPrevious();
            renderHeader();
            void loadView(current);
        });
        node.dataset.tab = tab;
        node.className = pref.tab === tab ? 'tab active' : 'tab';
        node.disabled = !meta;
        node.setAttribute('aria-pressed', String(pref.tab === tab));
        $('tabs').append(node);
    }
    const crumbs = $('breadcrumbs');
    crumbs.replaceChildren();
    if (meta) {
        crumbs.append(button(t('Array'), () => navigate([])));
        pref.prefix.forEach((value, index) => { crumbs.append(el('span', 'muted', '/'), button(`[${value}]`, () => navigate(pref.prefix.slice(0, index + 1)))); });
        crumbs.append(el('span', 'slice-shape', shapeText(meta.shape.slice(pref.prefix.length))));
    }
}
function navigate(prefix: number[]) {
    hideDetails(true);
    pref.prefix = prefix;
    pref.page = 0;
    pref.colPage = 0;
    pref.row = 0;
    pref.layout = 'row';
    save();
    const current = ++epoch;
    stopPrevious();
    renderHeader();
    void loadView(current);
}
async function openFile(reload = false) {
    if (reload)
        hideDetails(true);
    const current = ++epoch;
    stopPrevious();
    status(t(reload ? 'Reloading file…' : 'Reading array directory…'), true);
    chart?.dispose();
    chart = undefined;
    content.replaceChildren();
    controls.replaceChildren();
    try {
        const result = await rpc(reload ? 'reload' : 'open');
        if (current !== epoch)
            return;
        if(result.language) {setLanguage(resolveLanguage(result.language));pref.language=getLanguage();save();localizeShell();}
        entries = result.entries;
        selected = undefined;
        meta = undefined;
        stale = false;
        $('changed').hidden = true;
        renderList();
        renderHeader();
        const restore = entries.find(e => e.name === pref.name);
        if (restore) {
            await selectArray(restore.index, true);
            return;
        }
        renderWelcome();
    }
    catch (error) {
        if (current === epoch)
            showError(error);
    }
}
function renderWelcome() {
    content.replaceChildren(); const box=el('div','empty-state');
    box.append(el('div','empty-icon','▦'),el('h2','',t('{count} arrays, ready to explore',{count:formatNumber(entries.length)})),el('p','',t('Choose an array in the sidebar. Its data is loaded only when needed.')));
    content.append(box);status(t('Directory loaded · no array data decompressed'));
}
async function selectArray(index: number, restore = false) {
    if (stale) {
        await openFile(true);
        return;
    }
    const current = ++epoch;
    stopPrevious();
    selected = index;
    meta = undefined;
    if (!restore) {
        hideDetails(true);
        pref.prefix = [];
        pref.page = 0;
        pref.colPage = 0;
        pref.row = 0;
        pref.layout = 'row';
        pref.tab = 'Table';
    }
    pref.name = entries[index].name;
    save();
    renderList();
    renderHeader();
    chart?.dispose();
    chart = undefined;
    controls.replaceChildren();
    content.replaceChildren(el('div', 'loading', t('Loading selected array…')));
    status(t('Loading selected array…'), true);
    try {
        const result: Meta = await rpc('select', { array: index });
        if (current !== epoch)
            return;
        meta = result;
        if (pref.prefix.length > meta.shape.length || pref.prefix.some((i, axis) => !Number.isSafeInteger(i) || i < 0 || i >= meta!.shape[axis]))
            pref.prefix = [];
        renderHeader();
        await loadView(current);
    }
    catch (error) {
        if (current === epoch)
            showError(error);
    }
}
async function loadView(current: number) {
    if (!meta || selected === undefined)
        return;
    chart?.dispose();
    chart = undefined;
    controls.replaceChildren();
    content.replaceChildren();
    hideDetails();
    status(t('Preparing {view}…', { view: t(pref.tab) }), true);
    try {
        if (pref.tab === 'Table')
            await renderTable(current);
        else if (pref.tab === 'Plot')
            await renderPlot(current);
        else
            await renderHistogram(current);
    }
    catch (error) {
        if (current === epoch)
            showError(error);
    }
}
function numberInput(label: string, value: number, min: number, max: number, changed: (value: number) => void): HTMLLabelElement {
    const wrap = el('label', 'control-label', t(label));
    const input = el('input');
    input.type = 'number';
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.setAttribute('aria-label', t(label));
    input.addEventListener('change', () => { const next = Math.max(min, Math.min(max, Math.floor(Number(input.value) || min))); input.value = String(next); changed(next); });
    wrap.append(input);
    return wrap;
}
function selectInput(label: string, value: string, values: [
    string,
    string
][], changed: (value: string) => void): HTMLLabelElement {
    const wrap = el('label', 'control-label', t(label));
    const input = el('select');
    input.setAttribute('aria-label', t(label));
    for (const [key, text] of values) {
        const option = el('option', '', t(text));
        option.value = key;
        input.append(option);
    }
    input.value = value;
    input.addEventListener('change', () => changed(input.value));
    wrap.append(input);
    return wrap;
}
function checkInput(label: string, value: boolean, changed: (value: boolean) => void): HTMLLabelElement {
    const wrap = el('label', 'check-label');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = value;
    input.setAttribute('aria-label', t(label));
    input.addEventListener('change', () => changed(input.checked));
    wrap.append(input, document.createTextNode(t(label)));
    return wrap;
}
function refreshView() {
    if (stale) {
        void openFile(true);
        return;
    }
    save();
    const current = ++epoch;
    stopPrevious();
    void loadView(current);
}
async function renderTable(current: number) {
    const shape = meta!.shape.slice(pref.prefix.length);
    if (shape.length && shape[0])
        pref.page = Math.min(pref.page, Math.ceil(shape[0] / pref.pageSize) - 1);
    if (shape.length === 2 && shape[1])
        pref.colPage = Math.min(pref.colPage, Math.ceil(shape[1] / 8) - 1);
    const result = await rpc('table', { ...baseParams(), start: pref.page * pref.pageSize, count: pref.pageSize, columnStart: shape.length === 2 ? pref.colPage * 8 : 0, columnCount: 8 });
    if (current !== epoch)
        return;
    if (result.kind === 'scalar') {
        controls.append(el('span', 'muted', t(meta!.text ? 'Text / metadata' : 'Scalar')), button(t('Copy value'), () => vscode.postMessage({ type: 'copy', text: result.value })));
        if (result.truncated)
            controls.append(el('span', 'warning', t('Preview limited to 2 million characters')));
        const scalar = el('div', 'scalar');
        if (meta!.text && !result.truncated) {
            try {
                // Retain JSON number source text too (including integers beyond 2^53).
                const value = JSON.parse(result.value, ((_: string, value: unknown, context?: {
                    source?: string;
                }) => typeof value === 'number' && context?.source ? new JsonNumber(context.source) : value) as (key: string, value: any) => any);
                const tree = el('div', 'json-tree');
                tree.append(jsonNode(t('Text / metadata'), value, 0));
                scalar.append(tree);
                const raw = el('details', 'raw-json');
                raw.append(el('summary', '', t('Raw JSON (original text)')), el('pre', '', result.value));
                scalar.append(raw);
            }
            catch {
                scalar.append(el('pre', 'scalar-text', result.value));
            }
        }
        else
            scalar.append(el('pre', 'scalar-text', result.value));
        content.append(scalar);
    }
    else if (result.kind === 'empty') {
        content.append(el('div', 'empty-state', t('Empty array · {shape}', { shape: shapeText(result.shape) })));
    }
    else {
        const pages = Math.ceil(result.totalRows / pref.pageSize);
        const go = (page: number) => { pref.page = Math.max(0, Math.min(pages - 1, page)); refreshView(); };
        const first = button('«', () => go(0), t('First page'));
        first.disabled = pref.page === 0;
        first.setAttribute('aria-label', t('First page'));
        const previous = button('‹', () => go(pref.page - 1), t('Previous page'));
        previous.disabled = pref.page === 0;
        previous.setAttribute('aria-label', t('Previous page'));
        const next = button('›', () => go(pref.page + 1), t('Next page'));
        next.disabled = pref.page + 1 >= pages;
        next.setAttribute('aria-label', t('Next page'));
        const last = button('»', () => go(pages - 1), t('Last page'));
        last.disabled = pref.page + 1 >= pages;
        last.setAttribute('aria-label', t('Last page'));
        controls.append(first, previous, numberInput('Page', pref.page + 1, 1, pages, p => go(p - 1)), el('span', 'muted', `/ ${pages.toLocaleString()}`), next, last);
        controls.append(selectInput('Rows', String(pref.pageSize), [['50', '50'], ['100', '100'], ['200', '200']], value => { pref.page = 0; pref.pageSize = Number(value); refreshView(); }));
        if (result.totalColumns > 8)
            controls.append(numberInput('Column page', pref.colPage + 1, 1, Math.ceil(result.totalColumns / 8), value => { pref.colPage = value - 1; refreshView(); }), el('span', 'muted', `/ ${Math.ceil(result.totalColumns / 8)}`));
        const tableWrap = el('div', 'table-wrap');
        const table = el('table', 'data-table');
        const head = el('thead');
        const headerRow = el('tr');
        headerRow.append(el('th', '', t('Index')));
        const columns = result.rows[0]?.values.length ?? 1;
        for (let c = 0; c < columns; c++)
            headerRow.append(el('th', '', result.kind === 'nested' ? t('Subarray') : result.kind === 'matrix' ? `[${result.columnStart + c}]` : t('Value')));
        head.append(headerRow);
        table.append(head);
        const body = el('tbody');
        for (const row of result.rows) {
            const tr = el('tr');
            tr.dataset.row = String(row.index);
            const index = el('th');
            index.scope = 'row';
            if (result.kind === 'matrix' || result.kind === 'nested')
                index.append(button(`[${row.index}] ›`, () => navigate([...pref.prefix, row.index]), t('Open this slice')));
            else
                index.textContent = String(row.index);
            tr.append(index);
            row.values.forEach((value: string, col: number) => {
                const td = el('td');
                if (result.kind === 'nested')
                    td.append(button(value, () => navigate([...pref.prefix, row.index])));
                else {
                    const valueButton = button(value, () => void showCell([...pref.prefix, row.index, ...(result.kind === 'matrix' ? [result.columnStart + col] : [])]), t('View and copy the full value'));
                    valueButton.className = 'cell';
                    valueButton.dataset.column = String(result.columnStart + col);
                    valueButton.dataset.indices = JSON.stringify([...pref.prefix, row.index, ...(result.kind === 'matrix' ? [result.columnStart + col] : [])]);
                    td.append(valueButton);
                }
                tr.append(td);
            });
            body.append(tr);
        }
        table.append(body);
        tableWrap.append(table);
        content.append(tableWrap);
    }
    renderDetails();
    status(t('{source} · {time} ms · Exact text values', { source: t(meta!.cached ? 'Cached array' : 'Array loaded'), time: formatNumber(result.elapsedMs, { maximumFractionDigits: 1 }) }));
    save();
}
async function showCell(indices: number[]) {
    const current = epoch;
    try {
        const result = await rpc('cell', { array: selected, indices });
        if (current !== epoch)
            return;
        details = { value: result.value, truncated: result.truncated, indices: [...indices], array: selected! };
        renderDetails();
    }
    catch (error) {
        status(errorText(error));
    }
}
class JsonNumber {
    constructor(readonly source: string) { }
}
function jsonNode(name: string, value: unknown, depth: number): HTMLElement {
    if (value instanceof JsonNumber || value === null || typeof value !== 'object' || depth >= 64) {
        const row = el('div', 'json-leaf');
        row.append(el('span', 'json-key', `${name}: `), el('span', 'json-value', value instanceof JsonNumber ? value.source : typeof value === 'string' ? value : JSON.stringify(value)));
        return row;
    }
    const details = el('details', 'json-node');
    const summary = el('summary');
    const keys = Object.keys(value);
    summary.append(el('span', 'json-key', name), el('span', 'muted', Array.isArray(value) ? ` [${keys.length}]` : ` {${keys.length}}`));
    details.append(summary);
    let rendered = false;
    details.addEventListener('toggle', () => {
        if (!details.open || rendered)
            return;
        rendered = true;
        const children = el('div', 'json-children');
        details.append(children);
        let offset = 0;
        const more = button(t('Show next 100'), append);
        function append() {
            more.remove();
            for (const key of keys.slice(offset, offset + 100))
                children.append(jsonNode(Array.isArray(value) ? `[${key}]` : key, (value as any)[key], depth + 1));
            offset += 100;
            if (offset < keys.length)
                children.append(more);
        }
        append();
    });
    if (depth === 0)
        details.open = true;
    return details;
}
function componentControl() {
    if (meta!.kind === 'c')
        controls.append(selectInput('Component', pref.component, [['real', 'Real'], ['imag', 'Imaginary'], ['magnitude', 'Magnitude'], ['phase', 'Phase']], value => { pref.component = value; refreshView(); }));
}
function chartControls(histogram = false) {
    if (!histogram)
        controls.append(checkInput('Log X', pref.logX, value => { pref.logX = value; save(); chart?.setLogs(pref.logX, pref.logY); }));
    controls.append(checkInput(histogram ? 'Log count' : 'Log Y', pref.logY, value => { pref.logY = value; save(); chart?.setLogs(histogram ? false : pref.logX, pref.logY); }));
    controls.append(button(t('Reset view'), () => chart?.reset()), button(t('Export SVG'), () => {
        if (chart)
            vscode.postMessage({ type: 'export', svg: chart.svg() });
    }));
    controls.append(el('span', 'chart-help', t('Wheel: zoom X · Shift: zoom Y · Drag: pan · Double-click: reset')));
}
function createChart(histogram: boolean) {
    const wrap = el('div', 'chart-wrap');
    const canvas = el('canvas');
    canvas.setAttribute('aria-label', t(histogram ? 'Histogram chart' : 'Waveform chart'));
    canvas.tabIndex = 0;
    const tooltip = el('div', 'chart-tooltip');
    tooltip.hidden = true;
    wrap.append(canvas, tooltip);
    content.append(wrap);
    chart = new Chart(canvas, tooltip, histogram);
    return chart;
}
async function renderPlot(current: number) {
    if (!meta!.numeric)
        throw new Error(t('This array contains text or an unsupported numeric type. Use Table to inspect its values.'));
    const shape = meta!.shape.slice(pref.prefix.length);
    if (shape.length > 2)
        throw new Error(t('Open a 1D or 2D slice in Table before plotting.'));
    componentControl();
    if (shape.length === 2) {
        const options: [
            string,
            string
        ][] = [['row', 'Selected row']];
        if (shape[0] === 2)
            options.push(['xyRows', 'X/Y from two rows']);
        if (shape[1] === 2)
            options.push(['xyColumns', 'X/Y from two columns']);
        if (!options.some(([key]) => key === pref.layout))
            pref.layout = 'row';
        controls.append(selectInput('Series', pref.layout, options, value => { pref.layout = value; refreshView(); }));
        if (pref.layout === 'row')
            controls.append(numberInput('Row index', pref.row, 0, Math.max(0, shape[0] - 1), value => { pref.row = value; refreshView(); }));
    }
    else
        pref.layout = 'row';
    const plotParams = { ...baseParams(), layout: pref.layout, row: pref.row };
    const result = await rpc('plot', { ...plotParams, columns: Math.max(100, content.clientWidth - 110) });
    if (current !== epoch)
        return;
    const view = createChart(false);
    chartControls();
    view.setData(result.points, result.xRange, result.yRange);
    view.setLogs(pref.logX, pref.logY);
    let zoomSequence = 0;
    let hoverSequence = 0;
    let hoverIndex = -1;
    view.onRange = async (range) => {
        const sequence = ++zoomSequence;
        try {
            const data = await rpc('plot', { ...plotParams, range, columns: Math.max(100, content.clientWidth - 110) });
            if (current === epoch && sequence === zoomSequence)
                view.updatePoints(data.points);
        }
        catch (error) {
            if (current === epoch)
                status(errorText(error));
        }
    };
    if (pref.layout === 'row')
        view.onHover = async (x) => {
            const index = Math.max(0, Math.min(result.length - 1, Math.round(x)));
            if (index === hoverIndex)
                return;
            hoverIndex = index;
            const sequence = ++hoverSequence;
            try {
                const sample = await rpc('sample', { ...plotParams, index });
                if (current === epoch && sequence === hoverSequence)
                    view.showTooltip(`[${sample.index}]  ${sample.value}`);
            }
            catch { /* A cancelled hover must not replace the active view. */ }
        };
    status(t('{count} samples · {points} preview points · {time} ms', { count: formatNumber(result.length), points: formatNumber(result.points.length), time: formatNumber(result.elapsedMs, { maximumFractionDigits: 1 }) }));
    save();
}
async function renderHistogram(current: number) {
    if (!meta!.numeric)
        throw new Error(t('This array contains text or an unsupported numeric type. Histograms require numeric values.'));
    componentControl();
    controls.append(numberInput('Bins', pref.bins, 8, 512, value => { pref.bins = value; refreshView(); }), checkInput('Exact: scan all values', pref.exact, value => { pref.exact = value; refreshView(); }));
    const result = await rpc('histogram', { ...baseParams(), bins: pref.bins, exact: pref.exact });
    if (current !== epoch)
        return;
    const stats = el('div', 'stats');
    const numeric = (value: number | null) => value === null ? '—' : formatNumber(value, { maximumSignificantDigits: 8 });
    const all = result.sampled === result.total;
    for (const [label, value] of [['Minimum', numeric(result.dataRange[0])], ['Maximum', numeric(result.dataRange[1])], ['Mean', numeric(result.mean)], ['Std. deviation', numeric(result.std)], ['Nonfinite', numeric(result.nonfinite)]]) {
        const card = el('div', 'stat');
        card.append(el('span', 'stat-label', t(label)), el('strong', '', value));
        stats.append(card);
    }
    content.append(stats);
    const preview = el('div', all ? 'analysis-note' : 'analysis-note approximate', all ? t('Exact statistics · all {count} values scanned', { count: formatNumber(result.total) }) : t('Approximate preview · {sampled} / {total} values sampled. Rare events can be missed.', { sampled: formatNumber(result.sampled), total: formatNumber(result.total) }));
    content.append(preview);
    const view = createChart(true);
    chartControls(true);
    view.setData(result.points, result.range, [0, Math.max(1, ...result.counts)]);
    view.setLogs(false, pref.logY);
    view.onHover = x => {
        const width = (result.range[1] - result.range[0]) / result.counts.length;
        const bin = Math.max(0, Math.min(result.counts.length - 1, Math.floor((x - result.range[0]) / width)));
        view.showTooltip(`${tick(result.range[0] + bin * width)} … ${tick(result.range[0] + (bin + 1) * width)}: ${result.counts[bin].toLocaleString()}`);
    };
    status(t('{mode} · {bins} bins · {time} ms', { mode: t(all ? 'Full scan' : 'Sampled preview'), bins: formatNumber(result.counts.length), time: formatNumber(result.elapsedMs, { maximumFractionDigits: 1 }) }));
    save();
}
const transform = (value: number, log: boolean) => log ? value > 0 ? Math.log10(value) : NaN : value;
const inverse = (value: number, log: boolean) => log ? 10 ** value : value;
function axisRange(range: Range, log: boolean): Range {
    let [min, max] = range;
    if (log)
        [min, max] = max > 0 ? [Math.max(min, max * 1e-6), max] : [.1, 1];
    min = transform(min, log);
    max = transform(max, log);
    if (!Number.isFinite(min) || !Number.isFinite(max))
        return [0, 1];
    if (min >= max) {
        const pad = Math.max(.5, Math.abs(min) * .01);
        return [min - pad, max + pad];
    }
    return [min, max];
}
const tick = (value: number) => value !== 0 && (Math.abs(value) >= 100000 || Math.abs(value) < .001) ? value.toExponential(2) : Number(value.toPrecision(6)).toString();
const xml = (value: string) => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
class Chart {
    onRange?: (range: Range) => void;
    onHover?: (x: number) => void;
    private points: Point[] = [];
    private originalX: Range = [0, 1];
    private originalY: Range = [0, 1];
    private x: Range = [0, 1];
    private y: Range = [0, 1];
    private logX = false;
    private logY = false;
    private width = 600;
    private height = 400;
    private drag?: {
        x: number;
        y: number;
        xr: Range;
        yr: Range;
    };
    private rangeTimer?: ReturnType<typeof setTimeout>;
    private hoverTimer?: ReturnType<typeof setTimeout>;
    private observer: ResizeObserver;
    private themeObserver: MutationObserver;
    private destroyed = false;
    private hoverActive = false;
    constructor(private canvas: HTMLCanvasElement, private tooltip: HTMLElement, private histogram: boolean) {
        this.observer = new ResizeObserver(() => { this.draw(); this.queueRange(); });
        this.observer.observe(canvas.parentElement!);
        this.themeObserver = new MutationObserver(() => this.draw());
        this.themeObserver.observe(document.body, { attributes: true });
        canvas.addEventListener('wheel', event => {
            event.preventDefault();
            const bounds = canvas.getBoundingClientRect();
            const axis = event.shiftKey ? this.y : this.x;
            const t = event.shiftKey ? 1 - (event.clientY - bounds.top - 18) / (this.height - 72) : (event.clientX - bounds.left - 84) / (this.width - 106);
            const factor = Math.exp(Math.max(-1, Math.min(1, event.deltaY * .002)));
            const center = axis[0] + t * (axis[1] - axis[0]);
            const next: Range = [center + (axis[0] - center) * factor, center + (axis[1] - center) * factor];
            const limit = (event.shiftKey ? this.logY : this.logX) ? 300 : 1e300;
            if (next.every(v => Number.isFinite(v) && Math.abs(v) < limit)) {
                if (next[1] - next[0] > 1e-12) {
                    if (event.shiftKey)
                        this.y = next;
                    else
                        this.x = next;
                }
            }
            this.draw();
            this.queueRange();
        }, { passive: false });
        canvas.addEventListener('pointerdown', event => {
            if (event.button !== 0)
                return;
            this.drag = { x: event.clientX, y: event.clientY, xr: [...this.x], yr: [...this.y] };
            canvas.setPointerCapture(event.pointerId);
            this.tooltip.hidden = true;
        });
        canvas.addEventListener('pointermove', event => {
            const bounds = canvas.getBoundingClientRect();
            if (this.drag) {
                const dx = (event.clientX - this.drag.x) / (this.width - 106) * (this.drag.xr[1] - this.drag.xr[0]);
                const dy = (event.clientY - this.drag.y) / (this.height - 72) * (this.drag.yr[1] - this.drag.yr[0]);
                this.x = [this.drag.xr[0] - dx, this.drag.xr[1] - dx];
                this.y = [this.drag.yr[0] + dy, this.drag.yr[1] + dy];
                this.draw();
                this.queueRange();
            }
            else {
                const px = event.clientX - bounds.left, py = event.clientY - bounds.top;
                this.hoverActive = px >= 84 && px <= this.width - 22 && py >= 18 && py <= this.height - 54;
                if (!this.hoverActive) {
                    this.tooltip.hidden = true;
                    return;
                }
                this.tooltip.style.left = `${Math.min(this.width - 200, Math.max(10, px + 12))}px`;
                this.tooltip.style.top = `${Math.max(8, py - 35)}px`;
                clearTimeout(this.hoverTimer);
                const x = inverse(this.x[0] + (px - 84) / (this.width - 106) * (this.x[1] - this.x[0]), this.logX);
                if (this.onHover)
                    this.hoverTimer = setTimeout(() => this.onHover?.(x), 70);
                else
                    this.showTooltip(`X ${tick(x)}`);
            }
        });
        const release = () => { this.drag = undefined; };
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('lostpointercapture', release);
        canvas.addEventListener('pointerleave', () => { this.hoverActive = false; this.tooltip.hidden = true; clearTimeout(this.hoverTimer); });
        canvas.addEventListener('dblclick', () => this.reset());
        canvas.addEventListener('keydown', event => {
            if (event.key === 'Home' || event.key === 'r') {
                event.preventDefault();
                this.reset();
            }
        });
    }
    setData(points: Point[], x: Range, y: Range) { this.points = points; this.originalX = x; this.originalY = y; this.reset(); }
    updatePoints(points: Point[]) {
        if (this.destroyed)
            return;
        this.points = points;
        this.draw();
    }
    setLogs(x: boolean, y: boolean) {
        if (x === this.logX && y === this.logY)
            return;
        this.logX = x;
        this.logY = y;
        this.reset();
    }
    reset() { this.x = axisRange(this.originalX, this.logX); this.y = axisRange(this.originalY, this.logY); const pad = (this.y[1] - this.y[0]) * .05; this.y = [this.histogram && !this.logY ? 0 : this.y[0] - pad, this.y[1] + pad]; this.draw(); this.queueRange(); }
    showTooltip(text: string) {
        if (this.destroyed || !this.hoverActive)
            return;
        this.tooltip.textContent = text;
        this.tooltip.hidden = false;
    }
    private queueRange() {
        clearTimeout(this.rangeTimer);
        if (!this.histogram)
            this.rangeTimer = setTimeout(() => {
                if (!this.destroyed)
                    this.onRange?.([inverse(this.x[0], this.logX), inverse(this.x[1], this.logX)]);
            }, 90);
    }
    private coordinates(): (Point | null)[] {
        return this.points.map(([x, y]) => {
            if (x === null || y === null)
                return null;
            const tx = transform(x, this.logX), ty = transform(y, this.logY);
            if (!Number.isFinite(tx) || !Number.isFinite(ty))
                return null;
            return [Math.max(-1e7, Math.min(1e7, 84 + (tx - this.x[0]) / (this.x[1] - this.x[0]) * (this.width - 106))), Math.max(-1e7, Math.min(1e7, this.height - 54 - (ty - this.y[0]) / (this.y[1] - this.y[0]) * (this.height - 72)))];
        });
    }
    private colors() { const style = getComputedStyle(document.body); return { text: style.getPropertyValue('--vscode-foreground').trim() || '#cbd5e1', grid: style.getPropertyValue('--vscode-panel-border').trim() || '#334155', background: style.getPropertyValue('--vscode-editor-background').trim() || '#111827', line: '#3b99de' }; }
    private draw() {
        if (this.destroyed)
            return;
        const bounds = this.canvas.parentElement!.getBoundingClientRect();
        this.width = Math.max(260, bounds.width);
        this.height = Math.max(220, bounds.height);
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        const ctx = this.canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);
        const colors = this.colors();
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeStyle = colors.grid;
        ctx.fillStyle = colors.text;
        ctx.font = '11px monospace';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const t = i / 5, x = 84 + (this.width - 106) * t, y = this.height - 54 - (this.height - 72) * t;
            ctx.beginPath();
            ctx.moveTo(x, 18);
            ctx.lineTo(x, this.height - 54);
            ctx.moveTo(84, y);
            ctx.lineTo(this.width - 22, y);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(tick(inverse(this.x[0] + t * (this.x[1] - this.x[0]), this.logX)), x, this.height - 32);
            ctx.textAlign = 'right';
            ctx.fillText(tick(inverse(this.y[0] + t * (this.y[1] - this.y[0]), this.logY)), 75, y + 4);
        }
        ctx.textAlign = 'center';
        ctx.fillText(t(this.histogram ? 'Value' : 'Index / X'), (this.width + 62) / 2, this.height - 10);
        ctx.textAlign = 'left';
        ctx.fillText(t(this.histogram ? 'Count' : 'Value'), 10, 12);
        ctx.save();
        ctx.beginPath();
        ctx.rect(84, 18, this.width - 106, this.height - 72);
        ctx.clip();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1.4;
        const points = this.coordinates();
        const baseline = this.logY ? this.height - 54 : this.height - 54 - (0 - this.y[0]) / (this.y[1] - this.y[0]) * (this.height - 72);
        if (this.histogram) {
            ctx.fillStyle = 'rgba(59,153,222,0.3)';
            let previous: Point | null = null;
            for (const point of points) {
                if (point && previous) {
                    ctx.beginPath();
                    ctx.moveTo(previous[0]!, baseline);
                    ctx.lineTo(previous[0]!, previous[1]!);
                    ctx.lineTo(point[0]!, point[1]!);
                    ctx.lineTo(point[0]!, baseline);
                    ctx.closePath();
                    ctx.fill();
                }
                previous = point;
            }
        }
        ctx.beginPath();
        let pen = false;
        for (const point of points) {
            if (!point) {
                pen = false;
                continue;
            }
            if (pen)
                ctx.lineTo(point[0]!, point[1]!);
            else
                ctx.moveTo(point[0]!, point[1]!);
            pen = true;
        }
        ctx.stroke();
        ctx.restore();
    }
    svg(): string {
        const colors = this.colors(), points = this.coordinates();
        let paths = '', segment = '';
        const flush = () => {
            if (segment)
                paths += `<path d="${segment}" fill="none" stroke="${colors.line}" stroke-width="1.4"/>`;
            segment = '';
        };
        let fills = '';
        const baseline = this.logY ? this.height - 54 : this.height - 54 - (0 - this.y[0]) / (this.y[1] - this.y[0]) * (this.height - 72);
        let previous: Point | null = null;
        for (const point of points) {
            if (!point) {
                flush();
                previous = null;
                continue;
            }
            segment += `${segment ? 'L' : 'M'}${point[0]!.toFixed(2)},${point[1]!.toFixed(2)} `;
            if (this.histogram && previous)
                fills += `<path d="M${previous[0]},${baseline} L${previous[0]},${previous[1]} L${point[0]},${point[1]} L${point[0]},${baseline} Z" fill="${colors.line}" fill-opacity=".3"/>`;
            previous = point;
        }
        flush();
        let axes = '';
        for (let i = 0; i <= 5; i++) {
            const t = i / 5, x = 84 + (this.width - 106) * t, y = this.height - 54 - (this.height - 72) * t;
            axes += `<path d="M${x},18 V${this.height - 54} M84,${y} H${this.width - 22}" stroke="${xml(colors.grid)}"/><text x="${x}" y="${this.height - 32}" text-anchor="middle">${tick(inverse(this.x[0] + t * (this.x[1] - this.x[0]), this.logX))}</text><text x="75" y="${y + 4}" text-anchor="end">${tick(inverse(this.y[0] + t * (this.y[1] - this.y[0]), this.logY))}</text>`;
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><rect width="100%" height="100%" fill="${xml(colors.background)}"/><defs><clipPath id="chart"><rect x="84" y="18" width="${this.width - 106}" height="${this.height - 72}"/></clipPath></defs><g fill="${xml(colors.text)}" font-family="monospace" font-size="11">${axes}<text x="${(this.width + 62) / 2}" y="${this.height - 10}" text-anchor="middle">${t(this.histogram ? 'Value' : 'Index / X')}</text><text x="10" y="12">${t(this.histogram ? 'Count' : 'Value')}</text></g><g clip-path="url(#chart)">${fills}${paths}</g></svg>`;
    }
    dispose() { this.destroyed = true; this.observer.disconnect(); this.themeObserver.disconnect(); clearTimeout(this.rangeTimer); clearTimeout(this.hoverTimer); }
}
window.addEventListener('message', event => {
    const message = event.data;
    if (message?.type === 'response') {
        const request = pending.get(message.id);
        if (!request)
            return;
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) {
            const error = new Error(message.error) as Error & {
                code?: string;
            };
            error.code = message.code ?? 'BACKEND';
            request.reject(error);
        }
        else
            request.resolve(message.result);
    }
    else if (message?.type === 'language' && resolveLanguage(message.language) !== getLanguage())
        applyLanguage(message.language, false);
    else if (message?.type === 'reload')
        void openFile(true);
    else if (message?.type === 'changed') {
        ++epoch;
        stale = true;
        chart?.dispose();
        chart = undefined;
        $('changed').hidden = false;
        status(t('File changed · reload required'));
    }
    else if (message?.type === 'backendError') {
        ++epoch;
        const error = new Error(message.message) as Error & {
            code: string;
        };
        error.code = 'BACKEND';
        showError(error);
    }
});
void openFile();
