/* Shared, dependency-free validation and calculations. Prices are line totals. */
(function (root) {
  'use strict';
  const categories = { meat: '고기', seafood: '해산물', food: '음식', drink: '음료', supplies: '기타' };
  const statuses = ['준비 예정', '구매 완료', '준비 완료'];
  const costTypes = ['미정', '공동 정산', '개인 제공'];
  const money = value => Math.round(value).toLocaleString('ko-KR') + '원';
  const weight = grams => grams === null ? '중량 확인 필요' : grams >= 1000 ? (grams / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 3 }) + 'kg' : grams.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + 'g';
  function validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) return ['JSON 객체가 필요합니다.'];
    if (data.schemaVersion !== 1) errors.push('schemaVersion은 1이어야 합니다.');
    if (!Number.isInteger(data.people) || data.people < 1 || data.people > 10000) errors.push('참석 인원은 1~10,000 사이 정수여야 합니다.');
    if (!Number.isSafeInteger(data.adjustment)) errors.push('조정액은 원 단위 정수여야 합니다.');
    if (!Number.isInteger(data.revision) || data.revision < 1) errors.push('revision은 1 이상의 정수여야 합니다.');
    if (typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))) errors.push('갱신 일시를 확인하세요.');
    const targets = data.meatTargetGrams;
    if (!targets || !Number.isFinite(targets.min) || !Number.isFinite(targets.max) || targets.min <= 0 || targets.max < targets.min) errors.push('고기 준비 기준을 확인하세요.');
    if (!Array.isArray(data.items)) return [...errors, 'items 배열이 필요합니다.'];
    if (data.items.length > 2000) errors.push('최대 2,000개 품목까지 지원합니다.');
    const ids = new Set(), names = new Set();
    data.items.forEach((item, index) => {
      const label = (index + 1) + '번째 품목: ';
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(label + '품목 객체가 필요합니다.'); return; }
      for (const key of ['id', 'name', 'owner', 'unit']) if (typeof item[key] !== 'string' || !item[key].trim() || item[key].length > 300) errors.push(label + key + ' 값을 확인하세요.');
      if (ids.has(item.id)) errors.push(label + '품목 ID가 중복됩니다.');
      ids.add(item.id);
      const name = typeof item.name === 'string' ? item.name.normalize('NFKC').replace(/\s/g, '').toLowerCase() : '';
      if (names.has(name)) errors.push(label + '동일한 상품명이 있습니다. 기존 상품의 수량을 수정하세요.');
      names.add(name);
      if (!Object.hasOwn(categories, item.category)) errors.push(label + '카테고리를 확인하세요.');
      if (!statuses.includes(item.status)) errors.push(label + '상태를 확인하세요.');
      if (!costTypes.includes(item.costType)) errors.push(label + '비용 구분을 확인하세요.');
      if (!Number.isFinite(item.qty) || item.qty <= 0 || item.qty > 1000000) errors.push(label + '수량은 0보다 커야 합니다.');
      if (item.grams !== null && (!Number.isFinite(item.grams) || item.grams < 0 || item.grams > 1000000000)) errors.push(label + '개당 중량을 확인하세요.');
      if (!Number.isSafeInteger(item.price) || item.price < 0) errors.push(label + '비용은 0 이상의 원 단위 정수여야 합니다.');
      if (typeof item.memo !== 'string' || item.memo.length > 3000) errors.push(label + '메모를 확인하세요.');
    });
    const gross = data.items.reduce((sum, item) => sum + (Number(item?.price) || 0), 0);
    if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(gross + data.adjustment) || gross + data.adjustment < 0) errors.push('예상 합계가 올바른 금액 범위를 벗어났습니다.');
    return errors;
  }
  function summarize(data) {
    const sum = items => items.reduce((n, item) => n + item.price, 0);
    const gross = sum(data.items);
    const meat = data.items.filter(item => item.category === 'meat');
    const meatGrams = meat.reduce((n, item) => n + (item.grams === null ? 0 : item.qty * item.grams), 0);
    const unknownMeat = meat.filter(item => item.grams === null).length;
    const perPerson = meatGrams / data.people;
    const target = data.meatTargetGrams;
    const readiness = unknownMeat ? '판단 보류' : perPerson < target.min ? '부족' : perPerson > target.max ? '넉넉함' : '적정';
    return {
      count: data.items.length, gross, net: gross + data.adjustment,
      shared: sum(data.items.filter(item => item.costType === '공동 정산')),
      personal: sum(data.items.filter(item => item.costType === '개인 제공')),
      undecided: sum(data.items.filter(item => item.costType === '미정')),
      meatGrams, unknownMeat, perPerson, readiness,
      ready: data.items.filter(item => item.status === '준비 완료').length,
      purchased: data.items.filter(item => item.status === '구매 완료').length,
      uncertain: data.items.filter(item => item.name.includes('확인 필요')).length,
      unassigned: data.items.filter(item => item.owner === '미지정').length
    };
  }
  root.Picnic = { categories, statuses, costTypes, money, weight, validate, summarize };
})(globalThis);
  
