// Smoke test for index.html. Run: npm install && npm test
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
let storage = {};

async function boot() {
    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        virtualConsole: new VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),  // jsdom can't do location.reload()
        url: 'http://localhost/',
        beforeParse(window) {
            const errors = [];
            window.__errors = errors;
            window.addEventListener('error', e => errors.push(e.message));
            window.confirm = () => true;
            // Persist localStorage across "page reloads"
            Object.keys(storage).forEach(k => window.localStorage.setItem(k, storage[k]));
        },
    });
    await new Promise(r => dom.window.document.readyState === 'complete' ? r() : dom.window.addEventListener('load', r));
    return dom.window;
}
const persist = w => { storage = { ...w.localStorage }; };
const $ = (w, id) => w.document.getElementById(id);
const submit = (w, id) => $(w, id).dispatchEvent(new w.Event('submit', { cancelable: true }));
const pick = (w, field, value) => {
    $(w, `${field}-trigger`).click();
    w.document.querySelector(`#${field}-trigger + .dropdown-options [data-value="${value}"]`).click();
};

(async () => {
    // New company
    let w = await boot();
    assert.ok($(w, 'current-time').textContent, 'clock shows immediately');
    assert.strictEqual($(w, 'start-btn').textContent, 'New Game', 'start screen without save');
    $(w, 'start-btn').click();
    assert.ok($(w, 'start-screen').hidden && w.eval('gameSpeed') === 1, 'start screen closes');
    w.eval('EVENT_CHANCE = 0');  // random events would break exact cash-flow checks
    $(w, 'company-name-setting').value = 'Acme';
    $(w, 'founder-name-setting').value = 'Ada';
    $(w, 'difficulty-setting').value = 'easy';
    submit(w, 'company-settings-form');
    assert.strictEqual(w.eval('gameState').money, 1000000);
    assert.strictEqual($(w, 'company-name').textContent, 'Acme');
    assert.ok($(w, 'modal-title').textContent.includes('(1/') && w.eval('gameSpeed') === 0, 'tutorial opens paused');
    w.document.querySelector('[data-x="tutorial"][data-id="1"]').click();
    assert.ok($(w, 'modal-title').textContent.includes('(2/') && $(w, 'create-model-page').classList.contains('active'), 'tutorial step 2 shows its page');
    w.document.querySelector('[data-x="tutorial"][data-id="-1"]').click();
    assert.ok($(w, 'modal-overlay').style.display === 'none' && w.eval('gameSpeed') === 1, 'skip closes and resumes');
    const gs = w.eval('gameState');
    assert.strictEqual($(w, 'investor-list').children.length, 3, 'investors rendered');
    assert.strictEqual(gs.competitors.length, 6, 'competitors generated');
    assert.strictEqual(new Set(gs.competitors.map(c => c.name)).size, 6, 'competitor names unique');
    assert.strictEqual($(w, 'competitor-list').children.length, 6);
    assert.strictEqual($(w, 'ranking-list').children.length, 7, 'rankings include you');
    assert.match($(w, 'company-ranking').textContent, /^#\d+$/);
    for (let i = 0; i < 300; i++) w.eval('tickWorld()');  // world grows but stays capped and valid
    assert.ok(gs.competitors.length >= 6 && gs.competitors.length <= 12);
    assert.ok(gs.investors.length <= 6);
    assert.ok(gs.competitors.every(c => Number.isFinite(c.valuation) && c.bestScore <= 100));

    // Settings mid-game must not reset money
    w.eval('gameState').money = 123;
    submit(w, 'company-settings-form');
    assert.strictEqual(w.eval('gameState').money, 123, 'money kept on settings save');
    w.eval('gameState').money = 1000000;

    // Model creation needs every dropdown
    $(w, 'model-name').value = '<b>Bolt</b>';
    submit(w, 'model-creation-form');
    assert.strictEqual(w.eval('gameState').models.length, 0, 'rejected without dropdowns');
    for (const [f, v] of [['model-family', 'coding'], ['model-architecture', 'moe'], ['model-size', '7b'], ['model-precision', 'bf16'], ['model-context', '32k'], ['model-safety', 'standard'], ['data-quality', 'high'], ['training-duration', 'quick'], ['training-objectives', 'programming']]) pick(w, f, v);
    submit(w, 'model-creation-form');
    assert.strictEqual(w.eval('gameState').models.length, 1);
    { const g = w.eval('gameState'), mi = w.eval('modelIncome'), m0 = g.models[0], rf = w.eval('rivalFactor'), keep = [g.market, m0.score];
      g.market = 1; const t = { ...m0, score: 50 }, base = mi(t); g.market = 1.3; assert.ok(mi(t) > base && base > 0, 'boom raises income'); g.market = keep[0];
      m0.score = 1; assert.strictEqual(rf(m0), 0.7, 'trailing rivals caps at -30%'); m0.score = keep[1]; }
    { const nd = w.eval('nextDemand'); let d = 1, lo = 9, hi = 0; for (let i = 0; i < 2000; i++) { d = nd(d); lo = Math.min(lo, d); hi = Math.max(hi, d); }
      assert.ok(lo >= 0.3 && hi <= 2.5 && hi - lo > 0.4, 'demand moves both ways within bounds'); }
    { const sc = w.eval('modelScore'), big = { size: '2t', dataQuality: 'specialized', duration: 'experimental', architecture: 'dense', precision: 'fp32', context: '1m', safety: 'none' };
      assert.ok(sc({ ...big, size: '7b', duration: 'quick', dataQuality: 'high' }) < 35 && sc(big) < 85, 'max build without research stays below 85'); }
    { const m0 = w.eval('gameState').models[0], c = w.eval('trainingCost'), i = w.eval('incomeMult'), base = { ...m0, context: '8k', safety: 'standard', precision: 'fp16', architecture: 'transformer' };
      assert.ok(c({ ...base, precision: 'int4' }) < c(base) && c({ ...base, context: '1m' }) > c(base), 'precision/context change cost');
      assert.ok(i({ ...base, safety: 'strict' }) > i(base) && i({ ...base, safety: undefined }) === i(base), 'safety changes income; old saves neutral'); }
    assert.strictEqual(w.document.querySelector('#model-list tr.fam th').firstChild.textContent.trim(), '<b>Bolt</b>', 'name escaped');
    assert.strictEqual($(w, 'model-family').value, '', 'dropdown value cleared');
    assert.strictEqual(w.document.querySelector('#model-family-trigger span').textContent, 'Select Model Family', 'label restored');
    assert.strictEqual($(w, 'headquarters-setting').value !== '', true, 'settings form untouched');
    assert.strictEqual(w.eval('gameState').money, 1000000 - w.eval('trainingCost(gameState.models[0])'), 'training charged');

    // Game loop: training finishes, release earns money, investor pays
    for (let i = 0; i < 20; i++) w.eval('tick()');
    const m = w.eval('gameState').models[0];
    assert.strictEqual(m.status, 'trained', 'training completes');
    assert.ok(m.score > 0 && m.score <= 100);
    w.document.querySelector('#model-list .release-btn').click();
    assert.strictEqual(m.released, true);
    const expected = w.eval('gameState.money + dailyIncome() - dailyExpenses()');
    w.eval('tick()');
    assert.strictEqual(w.eval('gameState').money, expected, 'daily cash flow applied');
    assert.ok(w.eval('dailyIncome()') > 0);
    w.eval('gameState').reputation = 0;
    w.eval('gameState').investors = [w.eval('genInvestor()'), w.eval('genInvestor()')];
    w.eval('gameState').investors[0].minReputation = 0; w.eval('gameState').investors[1].minReputation = 99;
    w.eval('updateUI()');
    w.document.querySelector('#investor-list .invest-btn').click();
    assert.strictEqual(w.eval('gameState').investors.length, 1, 'investor used once');
    assert.strictEqual(w.document.querySelector('#investor-list .invest-btn'), null, 'locked investor has no button');
    assert.ok($(w, 'transactions').children.length >= 2, 'transactions shown');
    w.eval('gameState').money = -1e9;
    w.eval('tick()');
    assert.strictEqual(w.eval('gameState').bankrupt, true, 'bankruptcy stops the game');
    const frozen = w.eval('gameState').currentDate;
    w.eval('tick()');
    assert.strictEqual(w.eval('gameState').currentDate, frozen);
    w.eval('gameState').bankrupt = false; w.eval('gameState').money = 1000000;

    // Expansion: staff, hardware, research, marketing, benchmarks, deals, events, achievements
    const x = (act, id = '', v = '') => { const b = w.document.createElement('button'); Object.assign(b.dataset, { x: act, id, v }); w.document.body.append(b); b.click(); b.remove(); };
    const g = w.eval('gameState');
    g.money = 1e12;
    w.eval('tickExtras(new Date(gameState.currentDate))');
    const nEmp = g.employees.length, cand = g.candidates[0];
    x('hire', cand.id);
    assert.strictEqual(g.employees.length, nEmp + 1, 'hired');
    assert.ok(w.eval('extraExpenses()') >= w.eval('payroll()'), 'payroll is an expense');
    const slots0 = w.eval('trainingSlots()'), speed0 = w.eval('trainSpeed()');
    x('buy', 'GPU Cluster');
    assert.strictEqual(w.eval('trainingSlots()'), slots0 + 1);
    assert.ok(w.eval('trainSpeed()') > speed0, 'more compute trains faster');
    g.researchPoints = 1000;
    const cost0 = w.eval('trainingCost(gameState.models[0])');
    x('research', 'attention');
    assert.ok(w.eval("hasTech('attention')") && w.eval('trainingCost(gameState.models[0])') < cost0, 'research cuts cost');
    x('research', 'scaling');
    assert.ok(!w.eval("hasTech('scaling')"), 'locked tech needs prerequisites');
    x('campaign', 'social'); x('campaign', 'social');
    assert.strictEqual(g.campaigns.length, 1, 'one campaign of a kind');
    x('bench', m.id);
    assert.strictEqual(g.benchmarks.length, 5, 'five suites');
    x('loan', '0');
    assert.strictEqual(w.eval('totalDebt()'), 500000);
    x('repay', g.loans[0].id);
    assert.strictEqual(w.eval('totalDebt()'), 0);
    g.deals.push({ id: 'd1', client: 'T', minScore: 1, perDay: 1000, days: 2, expires: 5, active: false });
    const inc0 = w.eval('dailyIncome()');
    x('deal', 'd1');
    assert.strictEqual(w.eval('dailyIncome()'), inc0 + 1000, 'deal pays daily');
    const target = g.competitors[0];
    x('acquire', target.id);
    assert.ok(!g.competitors.includes(target) && g.subsidiaries.length === 1, 'acquired');
    w.eval('EVENTS.forEach(e => e())');
    w.eval('tickExtras(new Date(gameState.currentDate))');
    assert.ok(g.achievements.includes('million') && g.achievements.includes('first-model'), 'achievements unlock');
    x('nextver', m.id);
    assert.strictEqual(g.models.length, 1, 'next version waits for the form');
    assert.ok($(w, 'model-name').readOnly && $(w, 'training-duration').value === 'quick' && $(w, 'model-version').value === '2.0', 'form prefilled');
    pick(w, 'training-duration', 'extended');
    pick(w, 'training-objectives', 'reasoning');
    submit(w, 'model-creation-form');
    assert.strictEqual(g.models.length, 2);
    assert.strictEqual(g.models[1].duration, 'extended', 'chosen duration used');
    assert.strictEqual(JSON.stringify(g.models[1].objectives), '["reasoning"]', 'chosen knowledge used');
    assert.ok(!$(w, 'model-name').readOnly, 'name unlocked after start');
    assert.strictEqual(g.models[1].generation, 2, 'next version');
    { const was = [m.released, g.models[1].released]; m.released = true; g.models[1].released = false; const solo = w.eval('modelIncome')(m); g.models[1].released = true; assert.ok(Math.abs(w.eval('modelIncome')(m) - solo / 2) <= 1, 'newer released version halves old income'); [m.released, g.models[1].released] = was; }
    x('nextver', m.id);
    assert.strictEqual(g.models.length, 2, 'old version cannot be upgraded twice');
    w.eval('renderModelList()');
    assert.strictEqual(w.document.querySelector(`#model-list [data-x="nextver"][data-id="${m.id}"]`), null, 'old train button hidden');
    x('retire', m.id);
    { const g = w.eval('gameState'); w.eval('openCrisis(3)'); assert.strictEqual($(w, 'modal-overlay').style.display, 'grid', 'crisis pops up');
      assert.strictEqual(g.pendingCrisis, 3, 'time paused while crisis open'); const cash = g.money, X = g.crisisStake;
      w.document.querySelector('#modal-footer [data-x="crisis"][data-id="0"]').click();
      assert.ok(g.money === cash - X && g.pendingCrisis === null && $(w, 'modal-overlay').style.display === 'none', 'choice applies and closes'); }
    { const n = w.eval('gameState').benchmarks.length; x('bench', m.id); assert.strictEqual(w.eval('gameState').benchmarks.length, n, 'retired model cannot be benchmarked');
      w.eval('renderModelList()'); assert.strictEqual(w.document.querySelector(`#model-list [data-x="bench"][data-id="${m.id}"]`), null, 'no benchmark button on retired model'); }
    assert.ok(w.document.querySelector(`#model-list [data-x="opensource"][data-id="${m.id}"]`), 'retired model can be open-sourced');
    x('opensource', m.id);
    assert.strictEqual(m.status, 'open-sourced');
    Object.assign(g.models[1], { released: true, status: 'released' });
    w.eval('renderModelList()');
    w.document.querySelector('#model-list [data-x="retirefamily"]').click();
    assert.ok(g.models.every(x => !x.released), 'retire family retires every live version');
    assert.strictEqual(w.document.querySelector('#model-list [data-x="retirefamily"]'), null, 'button gone once nothing is live');
    assert.ok([...w.document.querySelectorAll('#model-list tr:not(.fam)')].every(r => r.hidden), 'retired family collapses');
    w.document.querySelector('#model-list tr.fam th').click();
    assert.ok([...w.document.querySelectorAll('#model-list tr:not(.fam)')].every(r => !r.hidden), 'heading click expands');
    assert.match($(w, 'achievement-list').textContent, /Millionaire/);
    assert.strictEqual($(w, 'tech-tree').querySelectorAll('.card').length, 12);
    g.money = 1000000;
    w.eval('gameState').save(true);
    assert.deepStrictEqual(w.__errors, []);
    persist(w);

    // Reload: state and UI restored
    w = await boot();
    assert.strictEqual(w.eval('gameState').companyName, 'Acme');
    assert.ok($(w, 'start-btn').textContent === 'Continue Game' && w.eval('gameSpeed') === 0, 'paused behind continue screen');
    $(w, 'start-btn').click();
    assert.ok($(w, 'start-screen').hidden && w.eval('gameSpeed') === 1, 'continue unpauses');
    assert.strictEqual($(w, 'company-name').textContent, 'Acme');
    assert.strictEqual($(w, 'model-list').querySelectorAll('tr:not(.fam)').length, 2, 'models rendered after reload');
    assert.strictEqual($(w, 'total-models').textContent, '2');
    const slots = () => [...w.document.querySelectorAll('#save-slots .save-slot')];
    const act = (action, slot) => w.document.querySelector(`#save-slots [data-action="${action}"][data-slot="${slot}"]`);
    assert.strictEqual(slots().length, 5);
    assert.match(slots()[0].textContent, /Acme/);
    assert.match(slots()[0].textContent, /Current/);
    assert.match(slots()[1].textContent, /Empty/);
    // Copy current game to slot 3, then delete it
    act('copy', '3').click();
    assert.strictEqual(JSON.parse(w.localStorage.aiEmpireSave3).companyName, 'Acme', 'copy to slot');
    assert.match(slots()[2].textContent, /Acme/);
    act('delete', '3').click();
    assert.strictEqual(w.localStorage.getItem('aiEmpireSave3'), null, 'slot deleted');
    assert.match(slots()[2].textContent, /Empty/);
    assert.ok(act('export', '1'), 'export available for filled slot');
    storage = { ...w.localStorage };

    // Slot 2 is a separate, fresh game; slot 1 is untouched
    storage.aiEmpireSlot = '2';
    w = await boot();
    assert.strictEqual(w.eval('gameState').gameStarted, false, 'empty slot starts fresh');
    $(w, 'company-name-setting').value = 'Beta';
    submit(w, 'company-settings-form');
    persist(w);
    assert.strictEqual(JSON.parse(storage.aiEmpireSave).companyName, 'Acme');
    assert.strictEqual(JSON.parse(storage.aiEmpireSave2).companyName, 'Beta');

    // Import: bad file rejected, good file loaded into current slot
    const imp = async text => {
        Object.defineProperty($(w, 'import-save-file'), 'files', { value: [{ text: async () => text }], configurable: true });
        $(w, 'import-save-file').dispatchEvent(new w.Event('change'));
        await new Promise(r => setTimeout(r, 10));
    };
    await imp('{"hello": 1}');
    assert.strictEqual(JSON.parse(w.localStorage.aiEmpireSave2).companyName, 'Beta', 'invalid import rejected');
    await imp(storage.aiEmpireSave);
    assert.strictEqual(JSON.parse(w.localStorage.aiEmpireSave2).companyName, 'Acme', 'valid import saved to slot');
    assert.deepStrictEqual(w.__errors, []);
    console.log('game.test: all passed');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
