'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const { categories, money, weight, validate, summarize } = Picnic;
  let data, category = '', activeView = 'items', loading = false;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  function showView(view, focus = false) {
    activeView = view;
    $('items-view').hidden = view !== 'items'; $('stats-view').hidden = view !== 'stats';
    document.querySelectorAll('[data-view]').forEach(button => { const selected = button.dataset.view === view; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
    if (focus) $('list-title').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function renderItems() {
    const search = $('search').value.trim().toLocaleLowerCase('ko-KR');
    const owner = $('owner-filter').value;
    const items = data.items.filter(item => (!category || item.category === category) && (!owner || item.owner === owner) && (!search || (item.name + ' ' + item.memo).toLocaleLowerCase('ko-KR').includes(search)) && (!$('needs-check').checked || item.name.includes('확인 필요') || item.grams === null || item.owner === '미지정' || item.costType === '미정'));
    $('result-count').textContent = items.length + ' / ' + data.items.length + '개';
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const row = node('article', undefined, 'item');
      const content = node('div', undefined, 'item-content');
      content.append(node('h3', item.name, 'item-title'));
      const details = node('div', undefined, 'item-detail');
      details.append(node('span', item.owner), node('span', item.qty + item.unit), node('span', weight(item.grams === null ? null : item.qty * item.grams)));
      const tags = node('div', undefined, 'item-tags');
      tags.append(node('span', item.status, 'status ' + (item.status === '구매 완료' ? 'purchased' : item.status === '준비 완료' ? 'ready' : 'planned')), node('span', item.costType === '미정' ? '비용 구분 미정' : item.costType, 'cost-type'));
      if (item.name.includes('확인 필요')) tags.append(node('span', '상품명 확인 필요', 'uncertain'));
      content.append(details, tags);
      if (item.memo) content.append(node('p', item.memo, 'item-memo'));
      row.append(node('div', categories[item.category], 'category-mark ' + item.category), content, node('div', money(item.price), 'item-price'));
      fragment.append(row);
    });
    $('items-list').replaceChildren(fragment); $('empty').hidden = items.length > 0;
    document.querySelectorAll('[data-category]').forEach(button => { const selected = button.dataset.category === category; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
  }
  function renderAll() {
    const s = summarize(data);
    $('people-label').textContent = '저녁식사 ' + data.people + '명';
    $('count').textContent = s.count + '개'; $('total').textContent = money(s.net); $('meat').textContent = weight(s.meatGrams);
    $('updated').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.updatedAt)) + ' 업데이트 · v' + data.revision;
    const buttons = [['', '전체'], ...Object.entries(categories)].map(([value, label]) => {
      const button = node('button', label); button.dataset.category = value;
      button.append(node('span', String(value ? data.items.filter(item => item.category === value).length : s.count), 'cat-count'));
      button.addEventListener('click', () => { category = value; renderItems(); }); return button;
    });
    $('categories').replaceChildren(...buttons);
    const oldOwner = $('owner-filter').value;
    const owners = [...new Set(data.items.map(item => item.owner))].sort((a, b) => a.localeCompare(b, 'ko'));
    $('owner-filter').replaceChildren(new Option('모든 준비자', ''), ...owners.map(owner => new Option(owner, owner)));
    if (owners.includes(oldOwner)) $('owner-filter').value = oldOwner;
    const percent = s.count ? Math.round(s.ready / s.count * 100) : 0;
    $('ready-number').textContent = s.ready + ' / ' + s.count + '개 완료'; $('ready-percent').textContent = percent + '%'; $('ready-bar').style.width = percent + '%';
    $('status-summary').textContent = '준비 예정 ' + (s.count - s.ready - s.purchased) + '개 · 구매 완료 ' + s.purchased + '개 · 준비 완료 ' + s.ready + '개';
    $('shared-total').textContent = money(s.shared);
    $('undecided-note').textContent = s.undecided ? '비용 구분 미정 ' + money(s.undecided) + '은 아직 포함되지 않았어요.' : '공동 정산으로 지정한 품목만 합산했어요.';
    $('meat-total').textContent = weight(s.meatGrams); $('per-label').textContent = data.people + '명 기준 · 1인당'; $('meat-per').textContent = Math.round(s.perPerson).toLocaleString('ko-KR') + 'g';
    $('meat-readiness').textContent = s.readiness;
    $('meat-advice').textContent = s.unknownMeat ? '현재 확인된 양은 1인당 ' + Math.round(s.perPerson) + 'g이에요. 고기 ' + s.unknownMeat + '개 품목의 중량이 없어 부족·과다 판단을 보류했어요.' : s.readiness === '부족' ? '설정한 최소량까지 ' + weight(Math.max(0, data.people * data.meatTargetGrams.min - s.meatGrams)) + ' 더 필요해요.' : s.readiness === '넉넉함' ? '설정한 최대량보다 ' + weight(s.meatGrams - data.people * data.meatTargetGrams.max) + ' 많아요. 다른 음식과 함께 양을 조절해요.' : '설정한 준비 범위에 들어와 있어요. 다른 음식의 양도 함께 확인해요.';
    $('meat-target').textContent = '준비 참고 기준: 1인당 ' + data.meatTargetGrams.min + '–' + data.meatTargetGrams.max + 'g · 관리자가 조정할 수 있는 모임용 기준입니다.';
    for (const key of ['gross', 'net', 'personal', 'undecided']) $(key).textContent = money(s[key]); $('adjustment').textContent = (data.adjustment > 0 ? '+' : '') + money(data.adjustment);
    $('owners-list').replaceChildren(...owners.map(owner => {
      const items = data.items.filter(item => item.owner === owner), row = node('div', undefined, 'owner-line'), details = node('div');
      details.append(node('strong', owner), node('small', items.length + '개 · ' + money(items.reduce((n, item) => n + item.price, 0))));
      const button = node('button', '목록 보기'); button.setAttribute('aria-label', owner + ' 준비물 목록 보기'); button.addEventListener('click', () => { $('owner-filter').value = owner; category = ''; $('search').value = ''; $('needs-check').checked = false; renderItems(); showView('items', true); });
      row.append(details, button); return row;
    }));
    const checks = [];
    if (s.uncertain) checks.push('상품명 확인이 필요한 품목이 ' + s.uncertain + '개 있어요. 구매 전 정확한 상품을 확인해주세요.');
    if (s.unassigned) checks.push('준비자가 미지정인 품목이 ' + s.unassigned + '개 있어요. 담당자를 정해주세요.');
    if (s.unknownMeat) checks.push('고기 ' + s.unknownMeat + '개 품목의 개당 중량을 확인해주세요.');
    if (!data.items.some(item => item.category === 'drink')) checks.push('등록된 음료가 없어요. 음료 준비 여부를 확인해주세요.');
    checks.push('음식·해산물·음료는 인분과 용량 정보가 충분하지 않아 부족·과다를 자동 판정하지 않아요.');
    $('checklist').replaceChildren(...checks.map(text => node('li', text)));
    renderItems(); showView(activeView);
  }
  async function load() {
    if (loading) return; loading = true; $('refresh').disabled = true; $('retry').disabled = true; $('load-error').hidden = true;
    try {
      const url = new URL('data/items.json', document.baseURI); url.searchParams.set('t', Date.now());
      const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error('데이터 응답: ' + response.status);
      const next = await response.json(), errors = validate(next); if (errors.length) throw new Error(errors[0]);
      data = next; renderAll(); $('app').hidden = false;
    } catch (error) {
      $('load-error').hidden = false; $('error-message').textContent = data ? '이전 목록을 표시하고 있어요. 연결을 확인한 뒤 다시 불러와주세요.' : location.protocol === 'file:' ? '공유 URL로 접속하거나 README의 로컬 서버 실행 방법을 이용해주세요.' : '연결을 확인한 뒤 다시 시도해주세요. ' + error.message;
    } finally { loading = false; $('loading').hidden = true; $('refresh').disabled = false; $('retry').disabled = false; }
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $('search').addEventListener('input', () => data && renderItems()); $('owner-filter').addEventListener('change', () => data && renderItems()); $('needs-check').addEventListener('change', () => data && renderItems());
  $('clear-filters').addEventListener('click', () => { category = ''; $('search').value = ''; $('owner-filter').value = ''; $('needs-check').checked = false; renderItems(); });
  $('refresh').addEventListener('click', load); $('retry').addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
  load();
})();
  
