const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const places = fs.readFileSync(path.join(root, 'places.js'), 'utf8');
const person = (id, answers = [], votes = []) => ({ id, name: id, answers, votes, updated: 1 });
const settings = { days: 3, pace: 'balanced', start: 540, end: 1200, transport: 'mixed', budget: 200 };
const legacy = () => ({ version: 1, tripId: 'trip', me: 'me', people: [person('me', Array(15).fill(0), [1, 2])], settings: { ...settings } });
function app(saved, hash = '') {
  const elements = new Map();
  const el = key => {
    if (!elements.has(key)) elements.set(key, {
      value: '', innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {} },
      addEventListener(type, cb) { this['on' + type] = cb; },
      showModal() { this.open = true; }, close() { this.open = false; },
      click() { this.onclick?.({ preventDefault() {} }); }
    });
    return elements.get(key);
  };
  let stored = saved ? JSON.stringify(saved) : null;
  const context = vm.createContext({
    crypto, TextEncoder, TextDecoder, Uint8Array, btoa, atob, URL, Blob,
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    document: { querySelector: el, querySelectorAll: () => [] },
    location: { hash, href: 'https://example.test/roam-kl/' + hash, pathname: '/roam-kl/', search: '' },
    history: { replaceState() {} }, window: { scrollTo() {} },
    setTimeout: () => 1, clearTimeout() {}, console
  });
  vm.runInContext(places, context);
  vm.runInContext(source, context);
  return { context, el, run: code => vm.runInContext(code, context), stored: () => JSON.parse(stored),
    json: code => JSON.parse(vm.runInContext('JSON.stringify(' + code + ')', context)) };
}

test('fresh overview has an honest empty state and next action', () => {
  const a = app();
  const stats = a.json('overviewStats()');
  assert.equal(stats.complete, 0);
  assert.equal(stats.total, 1);
  assert.equal(stats.ballots, 0);
  assert.equal(stats.ranked.length, 0);
  assert.equal(stats.next, 'quiz');
  assert.match(a.el('#app').innerHTML, /不是票選結果/);
  assert.match(a.el('#app').innerHTML, /日期待定/);
});

test('existing v1 data keeps votes and settings while receiving default trip metadata', () => {
  const a = app(legacy());
  assert.deepEqual(a.json('me().votes'), [1, 2]);
  assert.deepEqual(a.json('state.settings'), settings);
  assert.deepEqual(a.json('state.trip'), { title: '吉隆坡，一起走走', startDate: '' });
  assert.equal(a.json('overviewStats()').next, 'route');
  assert.equal(a.stored().trip.title, '吉隆坡，一起走走');
});

test('trip metadata validates actual calendar dates including leap years', () => {
  const a = app();
  assert.equal(a.json("cleanTrip({title:'  朋友旅行  ',startDate:'2028-02-29'})").startDate, '2028-02-29');
  assert.equal(a.json("cleanTrip({startDate:'2027-02-29'})").startDate, '');
  assert.equal(a.json("cleanTrip({startDate:'2026-04-31'})").startDate, '');
  assert.equal(a.json("cleanTrip({startDate:'2026-13-01'})").startDate, '');
  assert.equal(a.json('cleanTrip(null)').title, '吉隆坡，一起走走');
  assert.equal(a.json("cleanTrip({title:'x'.repeat(100)})").title.length, 60);
});

test('countdown follows Kuala Lumpur calendar day and distinguishes future, ongoing, and past trips', () => {
  const a = app();
  const date = now => a.json(`tripDateSummary({startDate:'2026-12-31'},3,new Date('${now}'))`);
  assert.equal(date('2026-12-29T16:30:00Z').badge, '1 天');
  assert.equal(date('2026-12-30T16:30:00Z').caption, 'DAY 1 / 3');
  assert.equal(date('2027-01-01T16:30:00Z').caption, 'DAY 3 / 3');
  assert.equal(date('2027-01-02T16:30:00Z').badge, '旅行回憶');
  assert.match(date('2026-12-30T16:30:00Z').range, /2027\/01\/02/);
});

test('saving edited trip updates sidebar, date range, settings, cache, and durable backup', () => {
  const a = app(legacy());
  a.run('plan=generate();activeDay=2;editTrip()');
  a.el('#tripTitle').value = '<朋友>的旅行';
  a.el('#tripStart').value = '2026-12-31';
  a.el('#tripDays').value = '4';
  a.el('#tripForm').onsubmit({ preventDefault() {} });
  assert.equal(a.stored().trip.title, '<朋友>的旅行');
  assert.equal(a.stored().settings.days, 4);
  assert.equal(a.el('#tripName').textContent, '<朋友>的旅行');
  assert.match(a.el('#app').innerHTML, /&lt;朋友&gt;的旅行/);
  assert.doesNotMatch(a.el('#app').innerHTML, /<朋友>/);
  assert.equal(a.run('plan'), null);
  assert.equal(a.run('activeDay'), 0);
  const restored = app(a.stored());
  assert.equal(restored.json('state.trip').startDate, '2026-12-31');
});

test('invalid edit leaves current trip untouched and provides an error', () => {
  const a = app(legacy());
  a.run('editTrip()');
  a.el('#tripTitle').value = '   ';
  a.el('#tripStart').value = '2026-02-30';
  a.el('#tripDays').value = '3';
  a.el('#tripForm').onsubmit({ preventDefault() {} });
  assert.equal(a.json('state.trip').title, '吉隆坡，一起走走');
  assert.match(a.el('#tripFormError').textContent, /有效日期/);
});

test('overview aggregates unique destinations and ballots, ranks ties deterministically, and lists all travelers', () => {
  const data = legacy();
  data.people.push(person('friend', Array(15).fill(1), [2, 3]), person('<旅伴>', [1], []));
  const a = app(data), stats = a.json('overviewStats()');
  assert.equal(stats.complete, 2);
  assert.equal(stats.total, 3);
  assert.equal(stats.voters, 2);
  assert.equal(stats.ballots, 4);
  assert.deepEqual(stats.ranked.map(p => p.id), [2, 1, 3]);
  assert.equal(stats.pending[0].id, '<旅伴>');
  assert.match(a.el('#app').innerHTML, /&lt;旅伴&gt;/);
  assert.doesNotMatch(a.el('#app').innerHTML, /<旅伴>/);
});

test('next action respects the current person rather than completed companions', () => {
  const data = legacy();
  data.people = [person('me', [0]), person('friend', Array(15).fill(0), [1])];
  const a = app(data);
  assert.equal(a.json('overviewStats()').next, 'quiz');
  a.run('me().answers=Array(15).fill(0)');
  assert.equal(a.json('overviewStats()').next, 'places');
  a.run('me().votes=[1]');
  assert.equal(a.json('overviewStats()').next, 'route');
});

test('encoded backups retain trip details and preserve Unicode names', () => {
  const a = app(legacy());
  a.run("state.trip={title:'一起去旅行 🌿',startDate:'2026-12-31'}");
  assert.deepEqual(a.json('decode(encode(payload()))'), a.json('payload()'));
  assert.equal(a.json('validate(decode(encode(payload()))).trip').title, '一起去旅行 🌿');
});

test('same-trip reply refreshes aggregate counts without replacing local trip settings', () => {
  const a = app(legacy());
  a.run(`importPayload({version:1,tripId:'trip',people:[{id:'friend',name:'旅伴',answers:Array(15).fill(1),votes:[2,3],updated:3}],trip:{title:'其他名字',startDate:'2026-12-31'}})`);
  assert.equal(a.json('overviewStats()').ballots, 4);
  assert.equal(a.json('overviewStats()').complete, 2);
  assert.equal(a.json('state.trip').title, '吉隆坡，一起走走');
  assert.equal(a.json('state.settings').days, 3);
});

test('confirmed backup restore recovers metadata and the original local person', () => {
  const a = app();
  a.run(`importPayload({version:1,tripId:'restored',localPerson:'owner',people:[{id:'owner',name:'原旅人',answers:[],votes:[],updated:1}],settings:{days:5},trip:{title:'恢復的旅程',startDate:'2026-11-20'}})`);
  a.el('#restoreTrip').click();
  assert.equal(a.json('state.trip').title, '恢復的旅程');
  assert.equal(a.json('state.settings').days, 5);
  assert.equal(a.json('state').me, 'owner');
});

test('invitation joins the shared trip with metadata and an independent traveler', () => {
  const host = app(legacy());
  host.run("state.trip={title:'旅伴的旅行',startDate:'2026-11-20'}");
  const incoming = host.run('encode(payload())');
  const guest = app(null, '#invite=' + incoming);
  guest.el('#joinName').value = '新朋友';
  guest.el('#joinTrip').click();
  assert.equal(guest.json('state.trip').title, '旅伴的旅行');
  assert.equal(guest.json('state.trip').startDate, '2026-11-20');
  assert.equal(guest.json('state.people').length, 2);
  assert.equal(guest.json('me()').name, '新朋友');
  assert.notEqual(guest.json('state').me, 'me');
});

test('overview station count matches actual schedule and enforces route constraints', () => {
  const data = legacy();
  data.people[0].votes = Array.from({ length: 56 }, (_, i) => i + 1);
  const a = app(data);
  for (const pace of ['slow', 'balanced', 'full']) {
    for (const transport of ['transit', 'mixed', 'taxi']) {
      a.run(`state.settings.pace='${pace}';state.settings.transport='${transport}'`);
      const plan = a.json('generate()'), seen = new Set();
      for (const day of plan.days) {
        assert.ok(day.stops.length <= { slow: 3, balanced: 5, full: 7 }[pace]);
        assert.ok(day.spent <= settings.budget);
        let end = settings.start;
        for (const stop of day.stops) {
          assert.ok(!seen.has(stop.p.id));
          seen.add(stop.p.id);
          assert.ok(stop.start >= Math.max(end, stop.p.open));
          assert.ok(stop.finish <= Math.min(settings.end, stop.p.close));
          end = stop.finish;
        }
      }
      assert.equal(seen.size + plan.rejected.length, 56);
      assert.match(a.run('overview()'), new RegExp(`<strong>${seen.size}<small> 個地點`));
    }
  }
});

test('storage failure is visibly reported instead of claiming a successful save', () => {
  const a = app();
  a.run("localStorage.setItem=()=>{throw Error('quota')};save()");
  assert.match(a.el('.saved').textContent, /無法儲存/);
});
