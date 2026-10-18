(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const state = {trips: [], shown: [], achievements: new Map(), selected: null, mode: 'all', mapOpen: false, map: null, railRoutes: null};
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const show = value => value === null || value === undefined || value === '' ? '未记录' : escapeHtml(value);
  const field = (label, value, extra = '', compact = false) => `<div class="field${compact ? '' : ' compact-hide'}"><small>${label}</small><strong class="${value === null || value === undefined || value === '' ? 'missing' : ''}">${show(value)}</strong>${extra ? `<span class="aux">${escapeHtml(extra)}</span>` : ''}</div>`;
  const aircraftModelField = (model, rarity) => {
    const levels = {common: '普通', rare: '稀有', epic: '史诗'};
    const key = Object.hasOwn(levels, rarity) ? rarity : 'unknown';
    return `<div class="field aircraft-field"><small>飞机型号</small><div class="aircraft-model"><strong class="${model ? '' : 'missing'}">${show(model)}</strong><span class="rarity-badge rarity-${key}" title="飞机稀有度：${escapeHtml(levels[key] || '未记录')}">${levels[key] || '未记录'}</span></div></div>`;
  };
  const trainModelField = (model, rarity) => {
    const levels = {'普通': 'common', '稀有': 'rare', '史诗': 'epic', '传说': 'legendary'};
    const key = levels[rarity] || 'unknown';
    return `<div class="field train-model-field"><small>车型</small><div class="aircraft-model"><strong class="${model ? '' : 'missing'}">${show(model)}</strong><span class="rarity-badge rarity-${key}" title="车型稀有度：${show(rarity)}">${show(rarity)}</span></div></div>`;
  };
  const location = place => [place?.country || '国家未记录', place?.province || '省份/州未记录', place?.city || '城市未记录'].join(' · ');
  const time = value => value ? escapeHtml(value) : '—:—';
  const duration = minutes => Number.isFinite(minutes) ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : null;
  const distance = km => Number.isFinite(km) ? `${Math.round(km).toLocaleString('zh-CN')} km` : null;
  const speed = kmh => Number.isFinite(kmh) ? `${kmh.toFixed(1)} km/h` : null;
  const routeName = trip => `${trip.origin.name || '未知地点'} → ${trip.destination.name || '未知地点'}`;
  const monthLabel = key => key === 'undated' ? '日期未记录' : `${key.slice(0, 4)} 年 ${Number(key.slice(5))} 月`;
  const airportLocation = place => [place.country, place.country === 'China' ? place.province : null, place.city].filter(Boolean).join(' · ') || '未记录';
  const airportPlace = (place, arrival = false) => `<div class="place airport-place${arrival ? ' arrival' : ''}"><strong title="${escapeHtml(place.name || '')}">${show(place.name)}</strong><span class="airport-en">${show(place.nameEn)}</span><span class="airport-code">${show(place.code)}</span><span class="airport-meta">${escapeHtml(airportLocation(place))}</span></div>`;
  const flightTime = (label, day, clock, offset, arrival = false) => `<div class="flight-time${arrival ? ' arrival' : ''}"><span class="flight-date">${show(day)}</span><strong>${time(clock)}</strong><small>${label}</small><span>${show(offset)}</span></div>`;
  const trainPlace = (place, arrival = false) => `<div class="place train-place${arrival ? ' arrival' : ''}"><strong title="${escapeHtml(place.name || '')}">${show(place.name)}</strong><small>${escapeHtml(location(place))}</small></div>`;
  const sameStation = (a, b) => Boolean(a && b && String(a).trim() === String(b).trim());
  const trainPath = trip => {
    const mergedStart = sameStation(trip.startTerminal, trip.origin.name);
    const mergedEnd = sameStation(trip.destination.name, trip.endTerminal);
    const stops = [
      ...(!mergedStart ? [{label: '始发', name: trip.startTerminal, nextLine: 'dashed'}] : []),
      {label: mergedStart ? '上车/始发' : '上车', name: trip.origin.name, nextLine: 'solid'},
      {label: mergedEnd ? '下车/终到' : '下车', name: trip.destination.name, nextLine: 'dashed'},
      ...(!mergedEnd ? [{label: '终到', name: trip.endTerminal}] : []),
    ];
    const content = stops.map((stop, index) => `${index ? `<span class="path-line ${stops[index - 1].nextLine}" aria-hidden="true"></span>` : ''}<div class="path-stop"><small>${stop.label}</small><strong>${show(stop.name)}</strong></div>`).join('');
    const description = stops.map(stop => `${stop.label} ${stop.name || '未记录'}`).join('，');
    return `<div class="train-path" aria-label="列车全程：${escapeHtml(description)}">${content}</div>`;
  };
  const clean = value => String(value ?? '').trim();
  const cityName = place => {
    const name = clean(place?.city);
    if (name === '香港特别行政区') return '香港';
    return ['China', '中国'].includes(clean(place?.country)) ? name.replace(/市$/, '') : name;
  };
  const cityKey = place => {
    const name = cityName(place);
    const country = clean(place?.country);
    return [name === '香港' ? '香港' : ['China', '中国'].includes(country) ? '中国' : country, name];
  };
  const eventMoment = (trip, arrival = false) => {
    const day = clean((arrival ? trip.arrivalDate : trip.departureDate) || trip.date);
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!dateParts) return Number.NEGATIVE_INFINITY;
    const clock = clean(arrival ? trip.arrivalTime : trip.departureTime);
    const clockParts = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clock);
    const hour = clockParts ? Number(clockParts[1]) : 12;
    const minute = clockParts ? Number(clockParts[2]) : 0;
    const second = clockParts ? Number(clockParts[3] || 0) : 0;
    const zone = clean((arrival ? trip.destination : trip.origin)?.utcOffset);
    const offsetParts = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
    const offsetMinutes = offsetParts ? (offsetParts[1] === '+' ? 1 : -1) * (Number(offsetParts[2]) * 60 + Number(offsetParts[3] || 0)) : 0;
    return Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]), hour, minute, second) - offsetMinutes * 60000;
  };
  const buildAchievements = trips => {
    const events = [];
    trips.forEach((trip, tripOrder) => {
      const recorded = new Set();
      let recordSlot = 0;
      const add = (category, label, name, identity, arrival = false) => {
        const value = clean(name);
        if (!value) return;
        const key = JSON.stringify([category, identity]);
        if (recorded.has(key)) return;
        recorded.add(key);
        events.push({tripId: trip.id, category, label, name: value, key, tripOrder, slot: recorded.size, moment: eventMoment(trip, arrival)});
      };
      const addRecord = (metric, label, value) => {
        if (!Number.isFinite(value) || value <= 0) return;
        const measured = metric.endsWith('speed') ? Math.round(value * 10) / 10 : Math.round(value);
        events.push({tripId: trip.id, category: 'record', metric, label, value: measured, tripOrder, slot: recorded.size + ++recordSlot, moment: eventMoment(trip, true)});
      };
      if (trip.mode === 'train') {
        const stationKey = place => [clean(place?.country), clean(place?.name)];
        add('station', '车站', trip.origin.name, stationKey(trip.origin));
        add('station', '车站', trip.destination.name, stationKey(trip.destination), true);
        add('city', '城市', cityName(trip.origin), cityKey(trip.origin));
        add('city', '城市', cityName(trip.destination), cityKey(trip.destination), true);
        add('train-model', '车型', trip.model, clean(trip.model));
        add('rail-operator', '铁路局', trip.operator, clean(trip.operator));
        addRecord('train-distance', '最远距离', trip.distanceKm);
        addRecord('train-duration', '最长乘坐时长', trip.durationMinutes);
        addRecord('train-speed', '最高平均速度', trip.speedKmh);
      } else {
        const airportKey = place => clean(place?.code) || [clean(place?.country), clean(place?.name)];
        add('airport', '机场', trip.origin.name, airportKey(trip.origin));
        add('airport', '机场', trip.destination.name, airportKey(trip.destination), true);
        add('city', '城市', cityName(trip.origin), cityKey(trip.origin));
        add('city', '城市', cityName(trip.destination), cityKey(trip.destination), true);
        add('aircraft-model', '机型', trip.model, clean(trip.model));
        add('airline', '航空公司', trip.airline, clean(trip.airline));
        const fromCountry = clean(trip.origin.country);
        const toCountry = clean(trip.destination.country);
        if (fromCountry && toCountry && fromCountry !== toCountry) add('country', '国家', toCountry, toCountry, true);
        addRecord('air-distance', '最远距离', trip.distanceKm);
        addRecord('air-duration', '最长乘坐时长', trip.durationMinutes);
      }
    });
    events.sort((a, b) => a.moment === b.moment
      ? a.tripOrder - b.tripOrder || a.slot - b.slot
      : a.moment - b.moment);
    const counts = new Map();
    const uniqueCounts = new Map([['country', 1]]);
    const rarityVisited = new Map();
    const records = new Map();
    const achievements = new Map(trips.map(trip => [trip.id, []]));
    events.forEach(event => {
      if (event.category === 'record') {
        const previous = records.get(event.metric);
        if (previous === undefined || event.value > previous) {
          records.set(event.metric, event.value);
          if (previous !== undefined) achievements.get(event.tripId).push({...event, previous});
        }
        return;
      }
      const base = event.category === 'country' && (event.name === 'China' || event.name === '中国') ? 1 : 0;
      const count = (counts.get(event.key) ?? base) + 1;
      counts.set(event.key, count);
      const first = count === 1;
      let ordinal = null;
      let rarityProgress = null;
      if (first) {
        ordinal = (uniqueCounts.get(event.category) || 0) + 1;
        uniqueCounts.set(event.category, ordinal);
        if (event.category === 'train-model' || event.category === 'aircraft-model') {
          const trip = trips[event.tripOrder];
          const rarity = clean(trip.rarity);
          const rarityKey = JSON.stringify([event.category, rarity]);
          const total = event.category === 'train-model' ? trip.rarityTotal : null;
          if (rarity && (event.category === 'aircraft-model' || (Number.isInteger(total) && total > 0))) {
            const seen = (rarityVisited.get(rarityKey) || 0) + 1;
            rarityVisited.set(rarityKey, seen);
            rarityProgress = {seen, total, rarity};
          }
        }
      }
      achievements.get(event.tripId).push({...event, count, first, ordinal, rarityProgress});
    });
    achievements.forEach(items => items.sort((a, b) => a.slot - b.slot));
    return achievements;
  };
  const recordDisplay = (metric, value) => metric.endsWith('duration') ? duration(value) : metric.endsWith('speed') ? speed(value) : distance(value);
  const achievementNouns = {station: '座车站', airport: '座机场', city: '座城市', country: '个国家', 'rail-operator': '个铁路局', airline: '家航空公司', 'train-model': '种车型', 'aircraft-model': '种机型'};
  const rarityNames = {common: '普通', rare: '稀有', epic: '史诗', legendary: '传说', retired: '退役'};
  const achievementSection = trip => {
    const items = state.achievements.get(trip.id) || [];
    const cards = items.map(item => item.category === 'record'
      ? `<div class="achievement-card record"><div class="achievement-top"><span>${escapeHtml(item.label)}</span><span class="achievement-record-mark"><i class="bi bi-trophy"></i> 刷新记录</span></div><strong>${recordDisplay(item.metric, item.value)}</strong><small>此前 ${recordDisplay(item.metric, item.previous)}</small></div>`
      : `<div class="achievement-card${item.first ? ' first' : ''}"><div class="achievement-top"><span>${escapeHtml(item.label)}</span>${item.first ? '<span class="achievement-first"><i class="bi bi-stars"></i> 首次</span>' : ''}</div><strong>${escapeHtml(item.name)}</strong><small>${item.first ? `首次打卡 · 打卡的第 ${item.ordinal} ${achievementNouns[item.category]}` : `第 ${item.count} 次打卡`}</small>${item.rarityProgress ? `<span class="achievement-progress">已打卡 ${item.rarityProgress.seen}${item.category === 'train-model' ? `/${item.rarityProgress.total}` : ''} 种${escapeHtml(rarityNames[item.rarityProgress.rarity] || item.rarityProgress.rarity)}${item.category === 'train-model' ? '车型' : '机型'}</span>` : ''}</div>`).join('');
    return `<div class="section-label">TRAVEL ACHIEVEMENTS / 旅行成就</div><div class="achievement-grid">${cards || '<p class="achievement-empty">这条行程暂无可统计的打卡项目。</p>'}</div>`;
  };

  const searchText = trip => [
    trip.origin?.name, trip.origin?.nameEn, trip.origin?.code, trip.origin?.city,
    trip.destination?.name, trip.destination?.nameEn, trip.destination?.code, trip.destination?.city,
    trip.mode === 'train' ? trip.startTerminal : null,
    trip.mode === 'train' ? trip.endTerminal : null,
  ].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();

  function renderList() {
    const from = $('#dateFrom').value, to = $('#dateTo').value;
    const keywords = $('#tripSearch').value.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
    state.shown = state.trips.filter(trip =>
      (state.mode === 'all' || trip.mode === state.mode)
      && (!from || (trip.date && trip.date >= from))
      && (!to || (trip.date && trip.date <= to))
      && (!keywords.length || keywords.every(keyword => searchText(trip).includes(keyword)))
    );
    $('#resultCount').textContent = `${state.shown.length} 条结果`;
    if (!state.shown.some(trip => trip.id === state.selected)) state.selected = state.shown[0]?.id || null;
    if (!state.shown.length) {
      $('#tripList').innerHTML = '<div class="list-empty">没有符合条件的行程。调整关键词或日期，或清除筛选。</div>';
      renderDetail();
      return;
    }
    let currentMonth = '';
    $('#tripList').innerHTML = state.shown.map(trip => {
      const month = trip.date?.slice(0, 7) || 'undated';
      const header = month !== currentMonth ? `<div class="date-heading">${monthLabel(month)}</div>` : '';
      currentMonth = month;
      return `${header}<button class="trip-item ${trip.mode}${state.selected === trip.id ? ' active' : ''}" role="option" aria-selected="${state.selected === trip.id}" type="button" data-id="${escapeHtml(trip.id)}"><span class="mode-icon"><i class="bi bi-${trip.mode === 'air' ? 'airplane' : 'train-front'}"></i></span><span class="trip-main"><strong>${escapeHtml(routeName(trip))}</strong><small>${escapeHtml(trip.date || '日期未记录')} · ${trip.mode === 'air' ? '飞机' : '火车'}</small></span><span class="trip-service">${show(trip.service)}</span></button>`;
    }).join('');
    $('#tripList').querySelectorAll('.trip-item').forEach(button => button.addEventListener('click', () => {
      state.selected = button.dataset.id;
      $('#tripList').querySelectorAll('.trip-item').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-selected', item === button ? 'true' : 'false');
      });
      renderDetail();
    }));
    renderDetail();
  }

  function renderDetail() {
    const trip = state.trips.find(item => item.id === state.selected);
    $('#mapToggle').disabled = !trip;
    if (!trip) {
      $('#tripDetail').innerHTML = '<div class="loading">请选择一段行程。</div>';
      $('#positionText').textContent = '';
      if (state.mapOpen) updateMap(null);
      return;
    }
    const position = state.shown.findIndex(item => item.id === trip.id) + 1;
    $('#positionText').textContent = `${String(position).padStart(2, '0')} / ${String(state.shown.length).padStart(2, '0')}`;
    const air = trip.mode === 'air';
    const airlineLogo = trip.logo ? `<img src="${escapeHtml(trip.logo)}" alt="${escapeHtml(trip.airline || '航空公司')}标志">` : '<span class="logo-placeholder" title="航空公司标志未记录"><i class="bi bi-airplane"></i></span>';
    const routeHeading = air
      ? `${airportPlace(trip.origin)}${flightTime('出发当地时间', trip.departureDate, trip.departureTime, trip.origin.utcOffset)}<span class="flight-direction"><span class="flight-logo">${airlineLogo}</span><span class="flight-number">${show(trip.service)}</span><span class="flight-arrow"><i class="bi bi-arrow-right"></i></span><span class="journey-duration">${show(duration(trip.durationMinutes))}</span></span>${flightTime('到达当地时间', trip.arrivalDate, trip.arrivalTime, trip.destination.utcOffset, true)}${airportPlace(trip.destination, true)}`
      : `${trainPlace(trip.origin)}${flightTime('上车时间', trip.departureDate, trip.departureTime, trip.origin.utcOffset)}<span class="train-direction"><span class="train-service">${show(trip.service)}</span><span class="train-arrow"><i class="bi bi-arrow-right"></i></span><span class="journey-duration">${show(duration(trip.durationMinutes))}</span><span class="train-operator">${show(trip.operator)}</span></span>${flightTime('下车时间', trip.arrivalDate, trip.arrivalTime, trip.destination.utcOffset, true)}${trainPlace(trip.destination, true)}`;
    const fieldSet = air ? [
      field('飞行里程', distance(trip.distanceKm), '', true), field('座位号', trip.seat, '', true),
      field('舱位', trip.cabin, '', true), aircraftModelField(trip.model, trip.rarity), field('飞机编号', trip.registration)
    ] : [
      field('座位号', trip.seat, '', true), field('席位', trip.cabin, '', true),
      field('总路程', distance(trip.distanceKm), '', true), field('平均速度', speed(trip.speedKmh), '', true),
      trainModelField(trip.model, trip.rarity)
    ];
    $('#tripDetail').innerHTML = `
      <div class="detail-head"><span class="record-label"><i class="mode-dot ${air ? 'air' : ''}"></i>${air ? 'FLIGHT JOURNEY / 航空' : 'RAIL JOURNEY / 铁路'}</span><span class="record-index">RECORD ${String(position).padStart(3, '0')}</span></div>
      <div class="route-heading${air ? ' air-route' : ' rail-route'}">${routeHeading}</div>
      ${air ? `<div class="trip-identity"><span class="airline-badge">${show(trip.airline)}</span></div>` : `<div class="section-label">TRAIN ROUTE / 列车全程</div>${trainPath(trip)}`}
      <div class="section-label">TRIP DETAILS / 完整记录</div><div class="field-grid${air ? ' air-detail-grid' : ' train-detail-grid'}">${fieldSet.join('')}</div>
      ${achievementSection(trip)}`;
    if (state.mapOpen) updateMap(trip);
  }

  function lineBetween(a, b) {
    const lonA = a[0], lonB = b[0];
    if (Math.abs(lonB - lonA) <= 180) return {type:'LineString',coordinates:[a,b]};
    const shifted = lonB + (lonB > lonA ? -360 : 360);
    const edge = lonA > 0 ? 180 : -180;
    const latitude = a[1] + (b[1] - a[1]) * ((edge - lonA) / (shifted - lonA));
    return {type:'MultiLineString',coordinates:[[a,[edge,latitude]],[[-edge,latitude],b]]};
  }

  async function routeGeometry(trip) {
    if (trip.mode === 'train' && trip.routeId) {
      if (!state.railRoutes) {
        state.railRoutes = fetch('data/rail_routes_real.geojson').then(response => response.ok ? response.json() : null).catch(() => null);
      }
      const routes = await state.railRoutes;
      const feature = routes?.features?.find(item => {
        const details = item.properties;
        return details?.trip_id === trip.routeId
          && String(details.train) === trip.service
          && details.from === trip.origin.name
          && details.to === trip.destination.name
          && (!details.date || !trip.date || String(details.date).slice(0, 10) === trip.date);
      });
      if (feature?.geometry) return {geometry: feature.geometry, real: true};
    }
    const a = trip.origin.coordinates, b = trip.destination.coordinates;
    return a && b ? {geometry: lineBetween(a, b), real: false} : null;
  }

  function initMap() {
    if (state.map || !window.maplibregl) return Boolean(state.map);
    state.map = new maplibregl.Map({container:'routeMap',style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'osm',paint:{'raster-saturation':-.55,'raster-brightness-max':.78}}]},center:[112,32],zoom:3,attributionControl:true});
    state.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
    state.map.on('load', () => {
      state.map.addSource('journey',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      state.map.addLayer({id:'route-halo',type:'line',source:'journey',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#132e35','line-width':9,'line-opacity':.7}});
      state.map.addLayer({id:'route-line',type:'line',source:'journey',filter:['==',['geometry-type'],'LineString'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':4}});
      state.map.addLayer({id:'route-points',type:'circle',source:'journey',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':7,'circle-color':['get','color'],'circle-stroke-width':3,'circle-stroke-color':'#fff'}});
      updateMap(state.trips.find(item => item.id === state.selected));
    });
    return true;
  }

  async function updateMap(trip) {
    if (!state.mapOpen || !state.map?.getSource('journey')) return;
    const source = state.map.getSource('journey');
    const a = trip?.origin.coordinates, b = trip?.destination.coordinates;
    $('#mapRouteLabel').textContent = trip ? routeName(trip) : '未选择行程';
    if (!trip || !a || !b) {
      source.setData({type:'FeatureCollection',features:[]});
      $('#mapStatus').textContent = '此行程缺少可定位的出发地或目的地';
      return;
    }
    const selectedId = trip.id;
    $('#mapStatus').textContent = '正在绘制路线…';
    const route = await routeGeometry(trip);
    if (selectedId !== state.selected || !state.mapOpen) return;
    const color = trip.mode === 'air' ? '#ee8f75' : '#52cfc0';
    const features = route ? [{type:'Feature',geometry:route.geometry,properties:{color}}] : [];
    for (const point of [a,b]) features.push({type:'Feature',geometry:{type:'Point',coordinates:point},properties:{color}});
    source.setData({type:'FeatureCollection',features});
    $('#mapStatus').textContent = route?.real ? '铁路线路按已有轨迹展示' : '两地之间的示意连线';
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(a); bounds.extend(b);
    state.map.resize();
    if (Math.abs(a[0] - b[0]) > 180) state.map.flyTo({center:a,zoom:3});
    else state.map.fitBounds(bounds,{padding:70,maxZoom:10,duration:650});
  }

  $('#tripList').addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const items = [...$('#tripList').querySelectorAll('.trip-item')];
    const index = items.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))].focus();
  });
  document.querySelectorAll('.type-chip').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('.type-chip').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
    });
    renderList();
  }));
  $('#dateFrom').addEventListener('change', renderList);
  $('#dateTo').addEventListener('change', renderList);
  $('#tripSearch').addEventListener('input', renderList);
  $('#clearFilters').addEventListener('click', () => {
    $('#dateFrom').value = ''; $('#dateTo').value = ''; $('#tripSearch').value = '';
    document.querySelector('.type-chip[data-mode="all"]').click();
  });
  $('#mapToggle').addEventListener('click', () => {
    state.mapOpen = !state.mapOpen;
    $('#appShell').classList.toggle('map-open', state.mapOpen);
    $('#routeMapPanel').hidden = !state.mapOpen;
    $('#mapToggle').setAttribute('aria-expanded', String(state.mapOpen));
    $('#mapToggle .toggle-icon i').className = `bi bi-arrow-${state.mapOpen ? 'left' : 'right'}`;
    $('#mapToggle .toggle-copy strong').textContent = state.mapOpen ? '收起路线地图' : '展开路线地图';
    $('#mapToggle .toggle-copy small').textContent = state.mapOpen ? '返回完整行程信息' : '在地图上查看这一段旅程';
    if (state.mapOpen) {
      if (!initMap()) $('#mapStatus').textContent = '地图组件未能加载，请检查网络连接';
      setTimeout(() => {state.map?.resize(); updateMap(state.trips.find(item => item.id === state.selected));}, 80);
    }
  });

  fetch('data/trip_catalog.json').then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(trips => {
    state.trips = trips;
    state.achievements = buildAchievements(trips);
    $('#totalCount').textContent = trips.length;
    $('#railCount').textContent = trips.filter(trip => trip.mode === 'train').length;
    $('#airCount').textContent = trips.filter(trip => trip.mode === 'air').length;
    $('#loadStatus').textContent = ' · 数据已载入';
    renderList();
  }).catch(error => {
    $('#tripDetail').innerHTML = '<div class="loading">行程数据未能载入。请通过本地服务器打开页面。</div>';
    $('#loadStatus').textContent = ` · ${error.message}`;
    $('#tripList').innerHTML = '<div class="list-empty">无法读取行程列表。</div>';
  });
})();
