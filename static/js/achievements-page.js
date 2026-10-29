(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = window.TravelAchievements;
  const state = {data: null, view: 'overview'};
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeTripLink = tripId => `TravelAtlasTrips.html?trip=${encodeURIComponent(tripId)}`;
  const displayWhen = when => `${when?.date || '日期未记录'}${when?.time ? ` · ${when.time}` : ''}${when?.zone ? ` ${when.zone}` : ''}`;
  const tier = count => count >= 100 ? 5 : count >= 50 ? 4 : count >= 25 ? 3 : count >= 10 ? 2 : count >= 5 ? 1 : 0;
  const labelOf = key => ({city: '城市', station: '车站', airport: '机场'})[key];
  const categoryMeta = (category, row) => {
    const place = row.place || {};
    if (category === 'city') return [place.country, place.province].filter(Boolean).join(' · ');
    if (category === 'station') return [place.province, place.city].filter(Boolean).join(' · ');
    return [place.code, place.city, place.country].filter(Boolean).join(' · ');
  };
  const nextThreshold = category => api.nextMilestone(category, state.data.counts[category]);

  function renderOverview() {
    const {counts, unlocked, collections} = state.data;
    const countCards = Object.entries(api.categories).map(([key, category]) => `<div class="count-card"><i class="bi bi-${category.icon}" aria-hidden="true"></i><strong>${counts[key]}</strong><span>${category.unit}已打卡</span><small>下一枚 · ${nextThreshold(key)} ${category.unit}</small></div>`).join('');
    const collectionCards = collections.map(item => `<details class="collection-card${item.completed ? ' completed' : ''}"><summary><div class="collection-title"><span><i class="bi bi-collection"></i> ${item.completed ? '已完成' : '收集中'}</span><i class="bi bi-chevron-down" aria-hidden="true"></i></div><h3>${escapeHtml(item.title)}</h3><p>已打卡 ${item.seen} / ${item.total} 种车型</p><div class="progress" role="progressbar" aria-label="${escapeHtml(item.title)}" aria-valuenow="${item.seen}" aria-valuemin="0" aria-valuemax="${item.total}"><span style="width:${item.total ? item.seen / item.total * 100 : 0}%"></span></div></summary><div class="model-chips">${item.models.map(model => `<span class="model-chip${model.visit ? ' collected' : ''}" title="${model.visit ? `首次打卡：${escapeHtml(displayWhen(model.visit.when))}` : '尚未打卡'}">${escapeHtml(model.model)}${model.visit ? ' ✓' : ''}</span>`).join('')}</div></details>`).join('');
    const awardLabel = item => item.category === 'collection' ? '系列收集' : item.category === 'consecutive' ? '特别成就' : api.categories[item.category].title;
    const awardBody = item => `<div class="card-top"><span>${escapeHtml(awardLabel(item))}</span><i class="bi bi-award" aria-hidden="true"></i></div><strong>${escapeHtml(item.title)}</strong><span class="detail">${escapeHtml(item.detail)}</span><small>达成 · ${escapeHtml(displayWhen(item.when))}</small>`;
    const awardLink = item => `<a href="${safeTripLink(item.tripId)}">查看达成行程 <i class="bi bi-arrow-up-right"></i></a>`;
    const achievementCards = api.groupUnlocked(unlocked).map(group => {
      const [latest, ...historyItems] = group.items;
      const items = group.items;
      if (items.length === 1) return `<article class="milestone-card">${awardBody(latest)}${awardLink(latest)}</article>`;
      const history = historyItems.map(item => `<div class="milestone-history-item"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(displayWhen(item.when))}</small></span>${awardLink(item)}</div>`).join('');
      return `<details class="milestone-stack"><summary class="milestone-card">${awardBody(latest)}<span class="stack-hint">点击展开过往 ${items.length - 1} 枚 <i class="bi bi-chevron-down" aria-hidden="true"></i></span></summary><div class="milestone-history"><div class="milestone-latest-link">${awardLink(latest)}</div>${history}</div></details>`;
    }).join('');
    const nextGoals = ['city', 'station', 'airport', 'train-model', 'aircraft-model'].map(key => {
      const next = nextThreshold(key);
      return `<div class="next-goal"><strong>${api.categories[key].title}</strong><span>${counts[key]} / ${next} ${api.categories[key].unit}</span></div>`;
    }).join('');
    $('#achievementView').innerHTML = `<div class="overview-counts">${countCards}</div>
      <div class="section-head"><div><h2>系列全收集</h2><p>按更新后的车型列表统计同系列车型。</p></div></div><div class="collection-stack">${collectionCards}</div>
      <div class="section-head"><div><h2>已解锁成就</h2><p>城市、车站和机型的打卡里程碑。</p></div></div><div class="achievement-grid">${achievementCards || '<div class="empty">还没有已解锁的成就。</div>'}</div>
      ${nextGoals ? `<div class="section-head"><div><h2>下一个里程碑</h2></div></div><div class="next-goals">${nextGoals}</div>` : ''}`;
  }

  function renderPlaceRows(category) {
    const query = $('#placeSearch').value.normalize('NFKC').trim().toLowerCase();
    const sort = $('#placeSort').value;
    const rows = state.data.entries[category].filter(row => `${row.name} ${categoryMeta(category, row)}`.normalize('NFKC').toLowerCase().includes(query));
    if (sort === 'visits') rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
    else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    else rows.sort((a, b) => a.stamp - b.stamp || a.order - b.order);
    $('#placeResult').textContent = `显示 ${rows.length} / ${state.data.counts[category]} ${api.categories[category].unit}`;
    $('#placeCards').innerHTML = rows.length ? rows.map(row => `<article class="place-card tier-${tier(row.count)}"><div class="place-top"><span class="kind">${labelOf(category)}</span><span class="count">${row.count} 次打卡</span></div><h3>${escapeHtml(row.name)}</h3><span class="meta">${escapeHtml(categoryMeta(category, row))}</span><span class="first">首次打卡 · ${escapeHtml(displayWhen(row.when))}</span><a href="${safeTripLink(row.tripId)}">查看首次行程 <i class="bi bi-arrow-up-right"></i></a></article>`).join('') : '<div class="empty">没有匹配的打卡地点。</div>';
  }

  function renderPlaces(category) {
    const {counts} = state.data;
    const title = category === 'city' ? '城市巡礼' : category === 'station' ? '火车站' : '机场';
    const next = nextThreshold(category);
    $('#achievementView').innerHTML = `<div class="place-head"><div><span class="eyebrow">PLACES VISITED / 已打卡地点</span><h2>${title}</h2><p>距离 ${next} ${api.categories[category].unit}里程碑，还差 ${next - counts[category]}。</p></div><strong class="place-total">${counts[category]}</strong></div>
      <div class="place-tools"><label><i class="bi bi-search" aria-hidden="true"></i><input id="placeSearch" type="search" placeholder="搜索${labelOf(category)}" aria-label="搜索${labelOf(category)}" autocomplete="off"></label><select id="placeSort" aria-label="排序方式"><option value="first">按首次打卡</option><option value="visits">按打卡次数</option><option value="name">按名称</option></select></div><div class="place-legend" aria-label="打卡次数颜色门槛"><span>5 次</span><span>10 次</span><span>25 次</span><span>50 次</span><span>100 次</span></div><p class="place-result" id="placeResult"></p><div class="place-grid" id="placeCards"></div>`;
    $('#placeSearch').addEventListener('input', () => renderPlaceRows(category));
    $('#placeSort').addEventListener('change', () => renderPlaceRows(category));
    renderPlaceRows(category);
  }

  function selectView(view, updateHash = true) {
    state.view = ['overview', 'city', 'station', 'airport'].includes(view) ? view : 'overview';
    document.querySelectorAll('.view-switch button').forEach(button => {
      const selected = button.dataset.view === state.view;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (updateHash) history.replaceState(null, '', `#${state.view}`);
    if (!state.data) return;
    if (state.view === 'overview') renderOverview();
    else renderPlaces(state.view);
  }

  document.querySelectorAll('.view-switch button').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
  $('.view-switch').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = [...document.querySelectorAll('.view-switch button')];
    const current = buttons.findIndex(button => button === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = buttons[(current + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
    selectView(next.dataset.view);
    next.focus();
  });
  window.addEventListener('hashchange', () => selectView(location.hash.slice(1), false));
  selectView(location.hash.slice(1), false);
  Promise.all([
    fetch('data/trip_catalog.json').then(response => response.ok ? response.json() : Promise.reject(Error('行程数据读取失败'))),
    fetch('data/train_model_roster.json').then(response => response.ok ? response.json() : Promise.reject(Error('车型列表读取失败'))),
  ]).then(([trips, roster]) => {
    state.data = api.build(trips, roster);
    $('#unlockedCount').textContent = state.data.unlocked.length;
    selectView(state.view, false);
  }).catch(error => {
    $('#achievementView').innerHTML = `<div class="empty">${escapeHtml(error.message)}。请通过本地服务器打开页面。</div>`;
  });
})();
