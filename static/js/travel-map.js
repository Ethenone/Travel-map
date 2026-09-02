(function () {
    "use strict";

    // ========== 全局状态 ==========
    let currentMap = 'map1';

    // 图表实例
    let cityChartInstance = null;
    let floatingScatterChart = null;
    let floatingHistChart = null;
    let floatingTimeDistChart = null;
    let trainOverviewChart = null;

    // 数据缓存
    let chartsData = null;
    let statsData = null;
    let railLineData = null;
    let railAreaData = null;
    let cityData = null;
    let currentTravelScope = 'combined';
    let travelStatsInitialized = false;

    // 城市图表分页
    let currentCityIndex = 0;
    const CITIES_PER_PAGE = 12;
    let currentCityView = 'both';

    // 散点图类型
    let currentScatterType = 'time';
    let currentHistType = 'duration';

    const mapMeta = {
        map1: ['球面交通地图', '沿大圆最短路径浏览航空与铁路连接'],
        map2: ['真实铁路轨迹地图', '沿 OSM 铁路路网浏览行程，并联动探索常乘线路'],
        map3: ['公路轨迹地图', '查看自驾与公路旅程的真实轨迹'],
        map4: ['骑行热力地图', '观察骑行活动的空间覆盖与密度'],
        map5: ['中国城市探索等级', '按到访方式与频次回顾城市足迹'],
        map6: ['上海探索地图', '聚焦上海街道与区域探索进度']
    };

    // ========== DOM 元素 ==========
    const sidebarLeft = document.getElementById('sidebarLeft');
    const sidebarRight = document.getElementById('sidebarRight');
    const collapseLeftBtn = document.getElementById('collapseLeftBtn');
    const toggleRightBtn = document.getElementById('toggleRightBtn');
    const mapItems = document.querySelectorAll('.map-item');
    const mapContainers = document.querySelectorAll('.map-container');
    const statsTabs = document.querySelectorAll('.stats-tab');
    const statsPanels = document.querySelectorAll('.stats-panel');
    const travelScopeSwitch = document.getElementById('travelScopeSwitch');
    const travelScopeButtons = document.querySelectorAll('[data-travel-scope]');

    // 浮动面板
    const floatingScatterPanel = document.getElementById('floatingScatterPanel');
    const floatingHistPanel = document.getElementById('floatingHistPanel');
    const floatingTimeDistPanel = document.getElementById('floatingTimeDistPanel');

    // ========== 左侧边栏折叠 ==========
    collapseLeftBtn.addEventListener('click', () => {
        sidebarLeft.classList.toggle('collapsed');
        const isCollapsed = sidebarLeft.classList.contains('collapsed');
        const icon = collapseLeftBtn.querySelector('i');
        icon.className = isCollapsed
            ? 'bi bi-chevron-right'
            : 'bi bi-chevron-left';
        collapseLeftBtn.setAttribute('aria-expanded', String(!isCollapsed));
        collapseLeftBtn.setAttribute('aria-label', isCollapsed ? '展开地图选择栏' : '折叠地图选择栏');
    });

    // ========== 右侧面板折叠 ==========
    function setRightSidebarCollapsed(isCollapsed) {
        sidebarRight.classList.toggle('collapsed', isCollapsed);
        const icon = toggleRightBtn.querySelector('i');
        if (isCollapsed) {
            icon.className = 'bi bi-chevron-left';
        } else {
            icon.className = 'bi bi-chevron-right';
        }
        toggleRightBtn.setAttribute('aria-expanded', String(!isCollapsed));
        toggleRightBtn.setAttribute('aria-label', isCollapsed ? '展开统计面板' : '折叠统计面板');
        syncRightTogglePosition();
    }

    toggleRightBtn.addEventListener('click', () => {
        setRightSidebarCollapsed(!sidebarRight.classList.contains('collapsed'));
    });

    function syncRightTogglePosition() {
        if (sidebarRight.classList.contains('collapsed')) {
            toggleRightBtn.style.right = '0';
            return;
        }
        const sidebarWidth = window.innerWidth <= 820
            ? Math.min(380, window.innerWidth - 54)
            : 380;
        toggleRightBtn.style.right = `${sidebarWidth}px`;
    }

    // ========== 地图切换 ==========
    function switchMap(mapId) {
        mapItems.forEach(item => {
            const isActive = item.dataset.map === mapId;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-pressed', String(isActive));
        });

        mapContainers.forEach(container => {
            container.classList.toggle('active', container.id === `${mapId}-container`);
        });

        const activeFrame = document.querySelector(`#${mapId}-container iframe[data-src]`);
        if (activeFrame) {
            activeFrame.src = activeFrame.dataset.src;
            activeFrame.removeAttribute('data-src');
        }

        clearpopup();
        currentMap = mapId;
        travelScopeSwitch.hidden = mapId !== 'map1';

        const mapHasStats = mapId === 'map1' || mapId === 'map2';
        const keepCollapsedForViewport = window.innerWidth < 1180;
        setRightSidebarCollapsed(!mapHasStats || keepCollapsedForViewport);

        const [title, description] = mapMeta[mapId] || mapMeta.map1;
        document.getElementById('currentMapTitle').textContent = title;
        document.getElementById('currentMapDescription').textContent = description;

        // 根据地图类型切换统计面板
        if (mapId === 'map2') {
            document.querySelector('[data-stats="train"]').click();
            loadTrainStats();
        } else if (mapId === 'map1') {
            document.querySelector('[data-stats="travel"]').click();
            loadTravelStats();
            document.querySelectorAll('.floating-chart-panel').forEach(panel => panel.classList.remove('visible'));
        } else {
            document.querySelectorAll('.floating-chart-panel').forEach(panel => panel.classList.remove('visible'));
        }
    }

    mapItems.forEach(item => {
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-pressed', String(item.classList.contains('active')));
        item.addEventListener('click', () => switchMap(item.dataset.map));
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                switchMap(item.dataset.map);
            }
        });
    });

    // ========== 统计标签切换 ==========
    statsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            statsPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === `stats-${tab.dataset.stats}`);
            });
        });
    });

    travelScopeButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentTravelScope = button.dataset.travelScope;
            travelScopeButtons.forEach(item => {
                const isActive = item === button;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-pressed', String(isActive));
            });
            if (chartsData) renderTravelOverview();
        });
    });

    // ========== 颜色辅助函数 ==========
    function colorForGroup(group) {
        const predefined = {
            G: "rgba(31,119,180,0.8)", D: "rgba(255,127,14,0.8)",
            C: "rgba(44,160,44,0.8)", S: "rgba(214,39,40,0.8)",
            K: "rgba(148,103,189,0.8)", Z: "rgba(140,86,75,0.8)",
            T: "rgba(227,119,194,0.8)", "数字车次": "rgba(255,152,0,0.8)",
            "中国铁路广州局": "rgba(31,119,180,0.65)",
            "中国铁路北京局": "rgba(255,127,14,0.65)",
            "中国铁路成都局": "rgba(44,160,44,0.65)",
            "中国铁路武汉局": "rgba(214,39,40,0.65)",
            "中国铁路南昌局": "rgba(148,103,189,0.65)",
            "中国铁路太原局": "rgba(140,86,75,0.65)",
            "香港铁路": "rgba(227,119,194,0.65)",
            "中国铁路济南局": "rgba(255,152,0,0.65)",
            "中国铁路上海局": "rgba(0, 128, 128, 0.65)",
            "中国铁路昆明局": "rgba(255, 99, 71, 0.65)",
            "珠三角城际": "rgba(123, 104, 238, 0.65)",
            "中国铁路乌鲁木齐局": "rgba(128,128,0,0.65)"
        };
        return predefined[group] || "rgba(100,100,100,0.8)";
    }

    function getTrainGroup(train) {
        if (/^[A-Za-z]/.test(train)) return train[0].toUpperCase();
        return "数字车次";
    }

    function hmToFloat(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(":").map(Number);
        return h + m / 60;
    }

    // ========== 加载数据 ==========
    async function loadAllData() {
        try {
            [chartsData, statsData, railLineData, railAreaData] = await Promise.all([
                fetch("data/charts.json").then(r => r.json()),
                fetch("data/stats.json").then(r => r.json()),
                fetch("data/rail_line_stats.json").then(r => r.json()),
                fetch("data/rail_area_stats.json").then(r => r.json())
            ]);
            cityData = chartsData.citycount;
            return true;
        } catch (e) {
            console.error('加载数据失败:', e);
            showAppNotice('统计数据加载失败，请通过本地 HTTP 服务打开页面。');
            return false;
        }
    }

    function showAppNotice(message) {
        let notice = document.getElementById('appNotice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'appNotice';
            notice.setAttribute('role', 'alert');
            document.body.appendChild(notice);
        }
        notice.textContent = message;
        notice.classList.add('visible');
    }

    // ========== 旅行统计 ==========
    function sortedEntries(data) {
        return Object.entries(data).sort((a, b) => (b[1].total || 0) - (a[1].total || 0));
    }

    function getAirTravelOverview() {
        const cities = {};
        const countries = {};

        Object.values(chartsData.airportcount || {}).forEach(airport => {
            const cityName = airport.city || 'Unknown';
            const countryName = airport.country || 'Unknown';
            const city = cities[cityName] || {
                on: 0, off: 0, total: 0,
                lat: airport.lat, lng: airport.lng, country: countryName
            };
            const country = countries[countryName] || { on: 0, off: 0, total: 0 };

            for (const key of ['on', 'off', 'total']) {
                city[key] += airport[key] || 0;
                country[key] += airport[key] || 0;
            }
            cities[cityName] = city;
            countries[countryName] = country;
        });

        return { cities, countries };
    }

    function renderTravelOverview() {
        const airOnly = currentTravelScope === 'air';
        const overview = airOnly
            ? getAirTravelOverview()
            : { cities: chartsData.citycount, countries: chartsData.nationcount };
        const cityArray = sortedEntries(overview.cities || {});
        const intlcityArray = cityArray.filter(([, value]) => value.country !== 'China');
        const countryArray = sortedEntries(overview.countries || {});
        const airportArray = sortedEntries(chartsData.airportcount || {});
        const totalDepart = cityArray.reduce((sum, [, value]) => sum + (value.on || 0), 0);
        const top = (items, fallback = ['-', { total: 0 }]) => items[0] || fallback;
        const topCity = top(cityArray);
        const topForeignCity = top(intlcityArray);
        const topCountry = top(countryArray);
        const topAirport = top(airportArray);
        const airTime = statsData.air_total_time_minutes || 0;
        const totalTime = airOnly ? airTime : (statsData.combined_total_time_minutes || airTime);
        const totalDistance = airOnly
            ? (statsData.air_total_distance || 0)
            : (statsData.combined_total_distance || statsData.air_total_distance || 0);
        const totalHours = Math.floor(totalTime / 60);
        const remainingMinutes = totalTime % 60;
        const missingTimeTrips = airOnly ? 0 : (statsData.foreign_rail_missing_time_trips || 0);
        const missingDistanceTrips = airOnly ? 0 : (statsData.foreign_rail_missing_distance_trips || 0);
        const timeNote = missingTimeTrips ? `境外铁路有 ${missingTimeTrips} 条未填写时长，当前合计不含缺失值` : '全部行程均有时长记录';
        const distanceNote = missingDistanceTrips ? `境外铁路有 ${missingDistanceTrips} 条未填写里程，当前合计不含缺失值` : '全部行程均有里程记录';

        document.getElementById('travelStatsGrid').innerHTML = `
            <div class="stat-card">
                <div class="label">Total Trips</div>
                <div class="value">${totalDepart}<span class="unit"></span></div>
            </div>
            <div class="stat-card" title="${timeNote}">
                <div class="label">Total Time</div>
                <div class="value">${totalHours}<span class="unit">h</span> ${remainingMinutes}<span class="unit">m</span></div>
            </div>
            <div class="stat-card" title="${distanceNote}">
                <div class="label">Total Distance</div>
                <div class="value">${totalDistance.toLocaleString('en-US')}<span class="unit">km</span></div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Cities</div>
                <div class="value">${cityArray.length}<span class="unit"></span></div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Regions</div>
                <div class="value">${countryArray.length}<span class="unit"></span></div>
            </div>
            <div class="stat-card hoverable" data-action="travel-most-visited-city">
                <div class="label">Most Visited City</div>
                <div class="value">${topCity[0]}<span class="unit">${topCity[1].total || 0}</span></div>
            </div>
            <div class="stat-card hoverable" data-action="travel-most-visited-foreign-city">
                <div class="label">Most Visited Foreign City</div>
                <div class="value">${topForeignCity[0]}<span class="unit">${topForeignCity[1].total || 0}</span></div>
            </div>
            <div class="stat-card hoverable" data-action="travel-most-visited-country">
                <div class="label">Most Visited Region</div>
                <div class="value">${topCountry[0]}<span class="unit">${topCountry[1].total || 0}</span></div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Airports</div>
                <div class="value">${airportArray.length}<span class="unit"></span></div>
            </div>
            <div class="stat-card hoverable" data-action="travel-most-visited-airport">
                <div class="label">Most Visited Airport</div>
                <div class="value"><span class="compact-value">${topAirport[0]}</span><span class="unit">${topAirport[1].total || 0}</span></div>
            </div>
        `;

        initHover(cityArray.slice(0, 5), '[data-action="travel-most-visited-city"]', 'topTravelCitiesPopup', 'topTravelCitiesList');
        initHover(intlcityArray.slice(0, 5), '[data-action="travel-most-visited-foreign-city"]', 'topTravelForeignCitiesPopup', 'topTravelForeignCitiesList');
        initHover(countryArray.slice(0, 5), '[data-action="travel-most-visited-country"]', 'topTravelCountriesPopup', 'topTravelCountriesList');
        initHover(airportArray.slice(0, 5), '[data-action="travel-most-visited-airport"]', 'topAirportsPopup', 'topAirportsList');
    }

    async function loadTravelStats() {
        if (!cityData) await loadAllData();
        if (!cityData) return;
        renderTravelOverview();
        if (travelStatsInitialized) return;
        travelStatsInitialized = true;

        // 加载统计
        airlinesData = getAirlinesStats();
        sortDirection_airlines = [];
        renderairlinesTable('count');

        citiesData_air = getCitiesStats_air();
        sortDirection_cities_air = [];
        rendercitiesTable_air('count');

        airportsData = getAirportsStats();
        sortDirection_airports = [];
        renderairportsTable('count');

        aircraftsData = getAircraftsStats();
        sortDirection_aircrafts = [];
        renderaircraftsTable('count');

        AllAircraftsData = getAllAircraftsStats();
        sortDirection_AllAircrafts = [];
        renderAllAircraftsTable('count');


        const typelist = ['Airlines', 'Cities', 'Airports','Aircrafts','AllAircrafts'];
        typelist.forEach(type => {
            const btn =  `tab${type}Btn`;
            document.getElementById(btn).addEventListener('click', (e) => {
                if (e.target.classList.contains('active')) {
                    return;
                };
                typelist.forEach(t => {
                    document.getElementById(`tab${t}Btn`).classList.remove('active');
                    document.getElementById(`${t}Table`).style.display = 'none';
                });
                document.getElementById(`tab${type}Btn`).classList.add('active');
                document.getElementById(`${type}Table`).style.display = 'block';

            });

        });

    }

    // ========== 航空公司统计 ==========

    let currentAirlinesSort = 'count';    // count, name, alliance
    let airlinesData = [];
    let sortDirection_airlines = {};  // 记录每个列的排序方向

    function renderLogo(src, alt, extraStyle = '') {
        const invalidPath = !src || /\/\.png$/i.test(src) || /\/G1\.png$/i.test(src);
        if (invalidPath) return '';
        return `<img src="${src}" alt="${alt}" class="airline-logo" style="${extraStyle}" onerror="this.style.display='none'">`;
    }

    function getAirlinesStats() {
        if (!chartsData || !chartsData.airlines) return [];

        const airlinesData = chartsData.airlines;
        const totalTrips = Object.values(airlinesData).reduce((sum, m) => sum + (m.total || 0), 0);

        return Object.entries(airlinesData).map(([airlines, airlinesInfo]) => {
            
            return {
                airlines: airlines,
                count: airlinesInfo.total || 0,
                alliance: airlinesInfo.alliance || '',
                allianceimg: airlinesInfo.allianceimg || '',
                img: airlinesInfo.img || '',
                nationality: airlinesInfo.nationality || '',

            };
        });
    }

    // 修改排序函数
    function sortAirlines(sortBy) {
        if (sortDirection_airlines[sortBy] === undefined) {
            sortDirection_airlines[sortBy] = 'desc';
        } else {
            sortDirection_airlines[sortBy] = sortDirection_airlines[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_airlines[sortBy];

        return [...airlinesData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'name':
                    comparison = a.airlines.localeCompare(b.airlines);
                    break;
                case 'alliance':
                    comparison = a.alliance.localeCompare(b.alliance);
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderairlinesTable(sortby) {
        currentAirlinesSort = sortby;
        const container = document.getElementById('AirlinesTable');
        if (!container) return;

        const sortedData_airlines = sortAirlines(currentAirlinesSort);

        const sortArrow = (col) => {
            if (col !== currentAirlinesSort) return '';
            return sortDirection_airlines[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table" id="Airlines-table">
<thead>
    <tr>

        <th id="sortalliance_air" style="cursor:pointer; text-align:center;">
            Alliance${sortArrow('alliance')}
        </th>
        <th id="sortname_air" style="cursor:pointer;text-align:center;">
            Airlines${sortArrow('name')}
        </th>
        <th id="sortcount_air" style="cursor:pointer; text-align:center;">
            Count${sortArrow('count')}
        </th>
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_airlines.map(d => d.count), 1);

        sortedData_airlines.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            html += `
<tr>
    <td style="text-align: center; padding:2px 2px;">
        ${renderLogo(d.allianceimg, d.alliance, 'height:18px; width:auto')}
    </td>
    <td>
        ${renderLogo(d.img, d.airlines)}
    
        <span style="font-weight: 500;font-size:0.65rem;">${d.airlines}</span>
    </td>
    <td style="text-align: center; font-weight: 500;padding:2px 2px;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';

        html += `
        <div style="margin-top: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-align: center;">
I have flown ${sortedData_airlines.length} airlines
        </div>
        
    `;
        [['Sky Team',18],['Star Alliance',25],['Oneworld',15]].forEach(([a,t]) => {

            let src = 'pic/' + a + '.png';
            let adata = sortedData_airlines.filter(item => item.alliance === a);

            html += `
            <div style="margin-top: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-align: center;">
        ${renderLogo(src, a, 'height:18px; width:auto')}
        ${adata.reduce((sum,item)=>sum+(item.count || 0),0)} times ${adata.length}/${t} airlines 
        </div>
            `;
        });


        container.innerHTML = html;
        document.getElementById('sortname_air').addEventListener('click', () => renderairlinesTable('name'));
        document.getElementById('sortcount_air').addEventListener('click', () => renderairlinesTable('count'));
        document.getElementById('sortalliance_air').addEventListener('click', () => renderairlinesTable('alliance'));
    }


    // ========== 城市统计 ==========

    let currentCitiesSort_air = 'count';    // count, city, country
    let citiesData_air = [];
    let sortDirection_cities_air = {};  // 记录每个列的排序方向

    function getCitiesStats_air() {
        if (!chartsData || !chartsData.citycount) return [];

        const citiesData_air = chartsData.citycount;

        return Object.entries(citiesData_air).map(([city, cityInfo]) => {

            return {
                city: city,
                count: cityInfo.total || 0,
                country: cityInfo.country || '',

            };
        });
    }

    // 修改排序函数
    function sortCities_air(sortBy) {
        if (sortDirection_cities_air[sortBy] === undefined) {
            sortDirection_cities_air[sortBy] = 'desc';
        } else {
            sortDirection_cities_air[sortBy] = sortDirection_cities_air[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_cities_air[sortBy];

        return [...citiesData_air].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'city':
                    comparison = a.city.localeCompare(b.city);
                    break;
                case 'country':
                    comparison = a.country.localeCompare(b.country);
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function rendercitiesTable_air(sortby) {
        currentCitiesSort_air = sortby;
        const container = document.getElementById('CitiesTable');
        if (!container) return;

        const sortedData_cities_air = sortCities_air(currentCitiesSort_air);

        const sortArrow = (col) => {
            if (col !== currentCitiesSort_air) return '';
            return sortDirection_cities_air[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table">
<thead>
    <tr>
        <th id="sortcountry_air" style="cursor:pointer; text-align:center;">
            Country${sortArrow('country')}
        </th>
        <th id="sortcity_air" style="cursor:pointer; text-align:center;">
            City${sortArrow('city')}
        </th>
        <th id="sortcount_city_air" style="cursor:pointer;text-align:center;">
            Counts${sortArrow('count')}
        </th>
        
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_cities_air.map(d => d.count), 1);

        sortedData_cities_air.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            html += `
<tr>
    <td style="text-align: center;">
        <span style="font-weight: 300;font-size:0.7rem;">${d.country}</span>
    </td>
    <td>
        
        <span style="font-weight: 300;font-size:0.7rem;">${d.city}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';

        


        container.innerHTML = html;
        document.getElementById('sortcountry_air').addEventListener('click', () => rendercitiesTable_air('country'));
        document.getElementById('sortcity_air').addEventListener('click', () => rendercitiesTable_air('city'));
        document.getElementById('sortcount_city_air').addEventListener('click', () => rendercitiesTable_air('count'));
    }

    // ========== 机场统计 ==========

    let currentAirportsSort = 'count';    // count, airport, country
    let airportsData = [];
    let sortDirection_airports = {};  // 记录每个列的排序方向

    function getAirportsStats() {
        if (!chartsData || !chartsData.airportcount) return [];

        const airportsData = chartsData.airportcount;

        return Object.entries(airportsData).map(([airport, airportInfo]) => {

            return {
                airport: airport,
                count: airportInfo.total || 0,
                city: airportInfo.city || '',
                country: airportInfo.country || '',

            };
        });
    }

    // 修改排序函数
    function sortAirports(sortBy) {
        if (sortDirection_airports[sortBy] === undefined) {
            sortDirection_airports[sortBy] = 'desc';
        } else {
            sortDirection_airports[sortBy] = sortDirection_airports[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_airports[sortBy];

        return [...airportsData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'airport':
                    comparison = a.airport.localeCompare(b.airport);
                    break;
                case 'country':
                    comparison = a.country.localeCompare(b.country);
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderairportsTable(sortby) {
        currentAirportsSort = sortby;
        const container = document.getElementById('AirportsTable');
        if (!container) return;

        const sortedData_airports = sortAirports(currentAirportsSort);

        const sortArrow = (col) => {
            if (col !== currentAirportsSort) return '';
            return sortDirection_airports[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table" id="Airports-table">
<thead>
    <tr>
        <th id="sortcountry_airport" style="cursor:pointer;text-align:center;">
            Country${sortArrow('country')}
        </th>
        <th id="sortairport" style="cursor:pointer; text-align:center;">
            Airport${sortArrow('airport')}
        </th>
        <th id="sortcount_airport" style="cursor:pointer; text-align:center;">
            Count${sortArrow('count')}
        </th>
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_airports.map(d => d.count), 1);

        sortedData_airports.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            html += `
<tr>
    <td style="text-align: center;">
        <span style="font-weight: 500;font-size:0.65rem;padding:0.3rem;">${d.country}</span>
    </td>
    <td>
        <span style="font-weight: 500;font-size:0.65rem;padding:0.3rem;">${d.airport}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';



        container.innerHTML = html;
        document.getElementById('sortcountry_airport').addEventListener('click', () => renderairportsTable('country'));
        document.getElementById('sortairport').addEventListener('click', () => renderairportsTable('airport'));
        document.getElementById('sortcount_airport').addEventListener('click', () => renderairportsTable('count'));
    }
    // ========== 飞机机型统计 ==========

    let currentAircraftsSort = 'count';    // count, airpcraft, company, rarity
    let aircraftsData = [];
    let sortDirection_aircrafts = {};  // 记录每个列的排序方向

    function getAircraftsStats() {
        if (!chartsData || !chartsData.aircrafts) return [];

        const aircraftsData = chartsData.aircrafts;
        

        return Object.entries(aircraftsData).map(([aircraft, aircraftInfo]) => {
            // 直接用你定义的稀有度
            const rarityLevel = aircraftInfo.rarity || '普通';

            // 根据稀有度等级分配样式类
            let rarityClass;
            switch (rarityLevel) {
                case 'legendary':
                    rarityClass = 'rarity-legendary';
                    break;
                case 'epic':
                    rarityClass = 'rarity-epic';
                    break;
                case 'rare':
                    rarityClass = 'rarity-rare';
                    break;
                case 'retired':
                    rarityClass = 'rarity-uncommon';
                    break;
                default:
                    rarityClass = 'rarity-common';
            }

            // 稀有度排序权重（越小越稀有）
            const rarityWeight = {
                'legendary': 1,
                'epic': 2,
                'rare': 3,
                'common': 4,
                'retired': 0.5
            };

            return {
                aircraft: aircraft,
                count: aircraftInfo.total || 0,
                company: aircraftInfo.company || '',

                rarityLevel: rarityLevel,
                rarityClass: rarityClass,
                rarityWeight: rarityWeight[rarityLevel] || 5,
            };
        });
    }

    // 修改排序函数
    function sortAircrafts(sortBy) {
        if (sortDirection_aircrafts[sortBy] === undefined) {
            sortDirection_aircrafts[sortBy] = 'desc';
        } else {
            sortDirection_aircrafts[sortBy] = sortDirection_aircrafts[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_aircrafts[sortBy];

        return [...aircraftsData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'aircraft':
                    comparison = a.aircraft.localeCompare(b.aircraft);
                    break;
                case 'company':
                    comparison = a.company.localeCompare(b.company);
                    break;
                case 'rarity':
                    comparison = b.rarityWeight - a.rarityWeight;
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderaircraftsTable(sortby) {
        currentAircraftsSort = sortby;
        const container = document.getElementById('AircraftsTable');
        if (!container) return;

        const sortedData_aircrafts = sortAircrafts(currentAircraftsSort);

        const sortArrow = (col) => {
            if (col !== currentAircraftsSort) return '';
            return sortDirection_aircrafts[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table" id="Aircrafts-table">
<thead>
    <tr>
        <th id="sortcompany_aircraft" style="cursor:pointer;text-align:center;">
            Company${sortArrow('company')}
        </th>
        <th id="sortaircraft" style="cursor:pointer; text-align:center;">
            Aircraft${sortArrow('aircraft')}
        </th>
        <th id="sortcount_aircraft" style="cursor:pointer; text-align:center;">
            Count${sortArrow('count')}
        </th>
        <th id="sortrarity_aircraft" style="cursor:pointer; text-align:center;">
            rarity${sortArrow('rarity')}
        </th>
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_aircrafts.map(d => d.count), 1);

        sortedData_aircrafts.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            html += `
<tr>
    <td style="text-align: center;">
        <span style="font-weight: 500;font-size:0.65rem;padding:0.3rem;">${d.company}</span>
    </td>
    <td>
        <span style="font-weight: 500;font-size:0.65rem;padding:0.3rem;">${d.aircraft}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    <td style="text-align: center;">
        <span class="rarity-badge ${d.rarityClass}">${d.rarityLevel}</span>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';



        container.innerHTML = html;
        document.getElementById('sortcompany_aircraft').addEventListener('click', () => renderaircraftsTable('company'));
        document.getElementById('sortaircraft').addEventListener('click', () => renderaircraftsTable('aircraft'));
        document.getElementById('sortcount_aircraft').addEventListener('click', () => renderaircraftsTable('count'));

        document.getElementById('sortrarity_aircraft').addEventListener('click', () => renderaircraftsTable('rarity'));
    }

    // ========== 所有飞机机型统计 ==========

    let currentAllAircraftsSort = 'count';    // count, airpcraft, company, rarity
    let AllAircraftsData = [];
    let sortDirection_AllAircrafts = {};  // 记录每个列的排序方向

    function getAllAircraftsStats() {
        if (!chartsData || !chartsData.allaircrafts) return [];

        const AllAircraftsData = chartsData.allaircrafts;


        return Object.entries(AllAircraftsData).map(([aircraft, aircraftInfo]) => {
            // 直接用你定义的稀有度
            const rarityLevel = aircraftInfo.rarity || '普通';

            // 根据稀有度等级分配样式类
            let rarityClass;
            switch (rarityLevel) {
                case 'legendary':
                    rarityClass = 'rarity-legendary';
                    break;
                case 'epic':
                    rarityClass = 'rarity-epic';
                    break;
                case 'rare':
                    rarityClass = 'rarity-rare';
                    break;
                case 'retired':
                    rarityClass = 'rarity-uncommon';
                    break;
                default:
                    rarityClass = 'rarity-common';
            }

            // 稀有度排序权重（越小越稀有）
            const rarityWeight = {
                'legendary': 1,
                'epic': 2,
                'rare': 3,
                'common': 4,
                'retired':0.5
            };

            return {
                aircraft: aircraft,
                count: aircraftInfo.total || 0,
                company: aircraftInfo.company || '',
                fullname: aircraftInfo.fullname || '',
                rarityLevel: rarityLevel,
                rarityClass: rarityClass,
                rarityWeight: rarityWeight[rarityLevel] || 5,
            };
        });
    }

    // 修改排序函数
    function sortAllAircrafts(sortBy) {
        if (sortDirection_AllAircrafts[sortBy] === undefined) {
            sortDirection_AllAircrafts[sortBy] = 'desc';
        } else {
            sortDirection_AllAircrafts[sortBy] = sortDirection_AllAircrafts[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_AllAircrafts[sortBy];

        return [...AllAircraftsData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'aircraft':
                    comparison = a.fullname.localeCompare(b.fullname);
                    break;
                case 'company':
                    comparison = a.company.localeCompare(b.company);
                    break;
                case 'rarity':
                    comparison = b.rarityWeight - a.rarityWeight;
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderAllAircraftsTable(sortby) {
        currentAllAircraftsSort = sortby;
        const container = document.getElementById('AllAircraftsTable');
        if (!container) return;

        const sortedData_AllAircrafts = sortAllAircrafts(currentAllAircraftsSort);

        const sortArrow = (col) => {
            if (col !== currentAllAircraftsSort) return '';
            return sortDirection_AllAircrafts[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table" id="AllAircrafts-table">
<thead>
    <tr>
        <th id="sortAllAircraft" style="cursor:pointer; text-align:center;">
            Aircraft${sortArrow('aircraft')}
        </th>
        <th id="sortcount_AllAircraft" style="cursor:pointer; text-align:center;">
            Count${sortArrow('count')}
        </th>
        <th id="sortrarity_AllAircraft" style="cursor:pointer; text-align:center;">
            rarity${sortArrow('rarity')}
        </th>
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_AllAircrafts.map(d => d.count), 1);

        sortedData_AllAircrafts.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            html += `
<tr>
    <td>
        <span style="font-weight: 500;font-size:0.6rem;padding:0.1rem;">${d.fullname}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    <td style="text-align: center;">
        <span class="rarity-badge ${d.rarityClass}">${d.rarityLevel}</span>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';



        container.innerHTML = html;
        document.getElementById('sortAllAircraft').addEventListener('click', () => renderAllAircraftsTable('aircraft'));
        document.getElementById('sortcount_AllAircraft').addEventListener('click', () => renderAllAircraftsTable('count'));

        document.getElementById('sortrarity_AllAircraft').addEventListener('click', () => renderAllAircraftsTable('rarity'));
    }

    // ========== 悬浮事件 ==========


    function initHover(data, card_name, popup_name, list_name) {
        const card = document.querySelector(card_name);
        const popup = document.getElementById(popup_name);

        if (!card || !popup) return;

        let hideTimeout;

        
        // 生成列表 HTML
        function initList(data) {

            document.getElementById(list_name).innerHTML = '';
            data.forEach((item, index) => {
                let rankClass = 'normal';
                if (index === 0) rankClass = 'top-1';
                else if (index === 1) rankClass = 'top-2';
                else if (index === 2) rankClass = 'top-3';

                document.getElementById(list_name).innerHTML += `<div class="top-item" id="${list_name}_${item[0]}">
                                    <span class="top-rank ${rankClass}">${index + 1}</span>
                                    <span class="top-name" title="${item[0]}">${item[0]}<span class="top-count">${item[1]['country']||''}</span></span>
                                    <span class="top-count">${item[1]['total']}</span>
                                </div>
                                `;
            });
            data.forEach((item, index) => {
                let top_card = document.getElementById(`${list_name}_${item[0]}`);
                top_card.addEventListener('mouseenter', function (e) {
                    top_card.style.background = 'rgba(0,255,255,0.08)';
                });

                top_card.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        top_card.style.background = '';
                    }, 150);
                });
            })
            return;
        }

        if (data.length > 0) {
            // 渲染列表
            initList(data);
        }

        // 定位弹出列表
        function positionPopup(cardRect) {
            const popupWidth = popup.offsetWidth || 220;
            const popupHeight = popup.offsetHeight || 200;

            // 默认显示在卡片右侧
            let left = cardRect.left - popupWidth - 12;
            let top = cardRect.top + (cardRect.height - popupHeight) / 2;



            // 确保不超出屏幕
            top = Math.max(10, Math.min(window.innerHeight - popupHeight - 10, top));

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
        }

        card.addEventListener('mouseenter', function (e) {

            clearpopup();

            // 清除隐藏定时器
            clearTimeout(hideTimeout);

            // 高亮卡片
            card.style.background = 'rgba(233, 69, 96, 0.15)';
            card.style.border = '1px solid rgba(233, 69, 96, 0.4)';
            card.style.cursor = 'pointer';




            if (data.length > 0) {

                // 定位弹出列表
                const cardRect = card.getBoundingClientRect();
                popup.style.display = 'block';

                // 先显示再定位（需要获取实际尺寸）
                requestAnimationFrame(() => {
                    positionPopup(cardRect);
                });


            }
        });


        hide = true;
        card.addEventListener('mouseleave', function () {
            // 延迟隐藏，防止快速划过闪烁
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    // 恢复卡片样式
                    card.style.background = '';
                    card.style.border = '';

                    // 隐藏弹出列表
                    popup.style.display = 'none';


                }, 150);
            }

        });

        // 弹出列表本身也能保持显示 点击or移入

        card.addEventListener('click', function () {
            hide = !hide;
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });

        popup.addEventListener('mouseenter', function () {
            clearTimeout(hideTimeout);
        });

        popup.addEventListener('mouseleave', function () {
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });


    }
    

    // ========== 火车统计 ==========
    async function loadTrainStats() {
        if (!statsData) await loadAllData();
        if (!statsData) return;


        // 概览卡片
        document.getElementById('trainStatsGrid').innerHTML = `
            <div class="stat-card">
                <div class="label">Total Trips</div>
                <div class="value">${statsData.total_trips || 0}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Time</div>
                <div class="value">${statsData.total_time[0] || 0}<span class="unit">h</span>${statsData.total_time[1] || 0}<span class="unit">min</span></div>
            </div>
            <div class="stat-card">
                <div class="label">Total Distance</div>
                <div class="value">${statsData.total_distance || 0}<span class="unit">km</span></div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Stations</div>
                <div class="value">${statsData.railway_station_count || 0}</div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Cities</div>
                <div class="value">${statsData.railway_city_count || 0}</div>
            </div>
            <div class="stat-card">
                <div class="label">Visited Provinces</div>
                <div class="value">${statsData.railway_prov_count || 0}</div>
            </div>
            <div class="stat-card hoverable" data-action="most-visited-station">
                <div class="label">Most Visited Station</div>
                <div class="value">${statsData.railway_stat_top[0]}<span class="unit" style="font-size:0.7rem; margin-left:6px;">${statsData.railway_stat_top[1]}次</span></div>
            </div>
            <div class="stat-card hoverable" data-action="most-visited-city">
                <div class="label">Most Visited City</div>
                <div class="value">${statsData.railway_city_top[0]}<span class="unit" style="font-size:0.7rem; margin-left:6px;">${statsData.railway_city_top[1]}次</span></div>
            </div>
            <div class="stat-card hoverable" data-action="most-visited-prov">
                <div class="label">Most Visited Prov</div>
                <div class="value">${statsData.railway_prov_top[0]}<span class="unit" style="font-size:0.7rem; margin-left:6px;">${statsData.railway_prov_top[1]}次</span></div>
            </div>

        `;




        // 行程记录
        const trainRecords = document.getElementById('trainRecords');
        if (trainRecords && statsData) {
            const longest = statsData.longest_trip || {};
            const shortest = statsData.shortest_trip || {};
            const farest = statsData.farest_trip || {};
            const nearest = statsData.nearest_trip || {};
            const fastest = statsData.fastest_trip || {};
            const slowest = statsData.slowest_trip || {};

            trainRecords.innerHTML = `
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Longest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(longest.train))};">${longest.train || '-'}</span>
                    ${longest.from || ''}→${longest.to || ''} (${longest.duration || '-'})
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Shortest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(shortest.train))};">${shortest.train || '-'}</span>
                    ${shortest.from || ''}→${shortest.to || ''} (${shortest.duration || '-'})
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Farest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(farest.train))};">${farest.train || '-'}</span>
                    ${farest.from || ''}→${farest.to || ''} (${farest.distance || '-'})
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Nearest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(nearest.train))};">${nearest.train || '-'}</span>
                    ${nearest.from || ''}→${nearest.to || ''} (${nearest.distance || '-'})
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Fastest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(fastest.train))};">${fastest.train || '-'}</span>
                    ${fastest.from || ''}→${fastest.to || ''} (${fastest.rate || '-'})
                </div>
                <div style="padding: 4px 0;" class="most-pad">
                    <span style="color: rgba(255,255,255,0.5);">Slowest Trip</span>
                    <span style="color: ${colorForGroup(getTrainGroup(slowest.train))};">${slowest.train || '-'}</span>
                    ${slowest.from || ''}→${slowest.to || ''} (${slowest.rate || '-'})
                </div>
                            `;
            Array.from(document.getElementsByClassName("most-pad")).forEach(mostpad => {
                const train = mostpad.getElementsByTagName('span')[1].innerText;

                mostpad.addEventListener('mouseenter', function (e) {
                    mostpad.style.background = 'rgba(0,255,255,0.08)';
                    const mapFrame = document.getElementById("map2Iframe");
                    mapFrame.contentWindow.postMessage({
                        type: "highlight_train",
                        train: train
                    }, window.location.origin);
                });

                mostpad.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        mostpad.style.background = '';
                    }, 150);
                });

            });
        }

        // 四至车站
        const fourCorners = document.getElementById('fourCorners');
        if (fourCorners && statsData) {
            const north = statsData.northernmost || {};
            const south = statsData.southernmost || {};
            const east = statsData.easternmost || {};
            const west = statsData.westernmost || {};

            fourCorners.innerHTML = `
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="cornerpad">
                    <span style="color: #ef4444;">⬆️ 最北：</span>
                    <span>${north.name || '-'}</span>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">(${(north.lat || 0).toFixed(2)}, ${(north.lng || 0).toFixed(2)})</span>
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="cornerpad">
                    <span style="color: #3b82f6;">⬇️ 最南：</span>
                    <span>${south.name || '-'}</span>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">(${(south.lat || 0).toFixed(2)}, ${(south.lng || 0).toFixed(2)})</span>
                </div>
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);" class="cornerpad">
                    <span style="color: #10b981;">➡️ 最东：</span>
                    <span>${east.name || '-'}</span>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">(${(east.lat || 0).toFixed(2)}, ${(east.lng || 0).toFixed(2)})</span>
                </div>
                <div style="padding: 4px 0;" class="cornerpad">
                    <span style="color: #f59e0b;">⬅️ 最西：</span>
                    <span>${west.name || '-'}</span>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">(${(west.lat || 0).toFixed(2)}, ${(west.lng || 0).toFixed(2)})</span>
                </div>
                            `;
            Array.from(document.getElementsByClassName("cornerpad")).forEach(cornerpad => {
                const station = cornerpad.getElementsByTagName('span')[1].innerText;;
                cornerpad.addEventListener('mouseenter', function (e) {
                    cornerpad.style.background = 'rgba(0,255,255,0.08)';
                    const mapFrame = document.getElementById("map2Iframe");
                    mapFrame.contentWindow.postMessage({
                        type: "highlight_station",
                        station: station
                    }, window.location.origin);
                });

                cornerpad.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        cornerpad.style.background = '';
                    }, 150);
                });

            });
        }

        drawTrainOverviewChart();
        initMostVisitedStationHover();
        initMostVisitedCityHover();
        initMostVisitedProvHover();

        // 加载统计
        trainTypeData = getTrainTypeStats();
        sortDirection = [];
        RailProvincesData = getRailProvinceStats();
        sortDirection_RailProvinces = [];
        renderRailProvincesTable('count');

        renderTrainTypeTable('count');

        StationsData = getTopStations();
        sortDirection_Stations = [];
        renderStationsTable('count');

        TrainCitiesData = getRailCityStats();
        sortDirection_TrainCities = [];
        renderTrainCitiesTable('count');

        renderRailLinesTable();

        const typelist = ['trainType', 'Stations', 'TrainCities', 'RailProvinces', 'RailLines'];
        typelist.forEach(type => {
            const btn = `tab${type}Btn`;
            document.getElementById(btn).addEventListener('click', (e) => {
                if (e.target.classList.contains('active')) {
                    return;
                };
                typelist.forEach(t => {
                    document.getElementById(`tab${t}Btn`).classList.remove('active');
                    document.getElementById(`${t}Table`).style.display = 'none';
                });
                document.getElementById(`tab${type}Btn`).classList.add('active');
                document.getElementById(`${type}Table`).style.display = 'block';

            });

        });

    }

    function renderRailLinesTable() {
        const container = document.getElementById('RailLinesTable');
        if (!container || !railLineData) return;
        const escapeHTML = value => String(value ?? '').replace(/[&<>"]/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
        })[character]);
        const lines = (railLineData.major_lines || [])
            .filter(line => line.coverage !== null)
            .sort((a, b) => b.trips - a.trips)
            .slice(0, 40);

        container.innerHTML = `
            <div class="rail-lines-note">覆盖度按 OSM 同名轨道区段估算；点击线路可在地图中高亮。</div>
            <div class="rail-lines-list">
                ${lines.map(line => {
                    const coverage = Math.round((line.coverage || 0) * 1000) / 10;
                    const frequency = Math.round((line.trip_share || 0) * 1000) / 10;
                    return `
                        <button class="rail-line-stat" type="button" data-line="${escapeHTML(line.line)}">
                            <div class="rail-line-heading">
                                <strong>${escapeHTML(line.line)}</strong>
                                <span>${line.trips} 次 · ${frequency}% 行程</span>
                            </div>
                            <div class="rail-coverage-row">
                                <span>已乘坐覆盖度</span><b>${coverage}%</b>
                            </div>
                            <div class="rail-coverage-track"><span style="width:${Math.min(100, coverage)}%"></span></div>
                            <div class="rail-top-section"><span>最常乘坐区间</span><strong>${escapeHTML(line.top_section || '-')}</strong><em>${line.top_section_trips || 0} 次</em></div>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.rail-line-stat').forEach(card => {
            card.addEventListener('click', () => {
                const mapFrame = document.getElementById('map2Iframe');
                mapFrame?.contentWindow?.postMessage({
                    type: 'highlight_line',
                    line: card.dataset.line
                }, window.location.origin);
            });
        });
    }

    function drawTrainOverviewChart() {
        const canvas = document.getElementById('trainOverviewChart');
        if (!canvas || !chartsData) return;

        const ctx = canvas.getContext('2d');
        if (trainOverviewChart) trainOverviewChart.destroy();

        const rides = chartsData.rides || [];
        const groupCounts = {};
        rides.forEach(r => { const g = getTrainGroup(r.train); groupCounts[g] = (groupCounts[g] || 0) + 1; });
        trainOverviewChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(groupCounts),
                datasets: [{
                    data: Object.values(groupCounts),
                    backgroundColor: Object.keys(groupCounts).map(colorForGroup),
                    borderColor: 'rgba(0,0,0,0.2)'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff',
                            usePointStyle: true
                        }
                    },
                    tooltip: {

                        enabled: true,
                        callbacks: {
                            label: function (context) {
                                const label = context.label;           // 扇形名称，如 "G", "D", "C"
                                const value = context.parsed;           // 对应的数值
                                const dataset = context.dataset;
                                const total = dataset.data.reduce((sum, val) => sum + val, 0);  // 总数
                                const percentage = ((value / total) * 100).toFixed(1);          // 百分比
                                const mapFrame = document.getElementById("map2Iframe");
                                mapFrame.contentWindow.postMessage({
                                    type: "highlight_train_type",
                                    train_type: label
                                }, window.location.origin);
                                return `${label}: ${value} 次 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ========== 车站统计 ==========

    let currentStationsSort = 'count';    // count, name, lat, lng
    let StationsData = [];
    let sortDirection_Stations = {};  // 记录每个列的排序方向

    // 修改排序函数
    function sortStations(sortBy) {
        if (sortDirection_Stations[sortBy] === undefined) {
            sortDirection_Stations[sortBy] = 'desc';
        } else {
            sortDirection_Stations[sortBy] = sortDirection_Stations[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_Stations[sortBy];

        return [...StationsData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.total - b.total;
                    break;
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'lat':
                    comparison = a.lat - b.lat;
                    break;
                case 'lng':
                    comparison = a.lng - b.lng;
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderStationsTable(sortby) {
        currentStationsSort = sortby;
        const container = document.getElementById('StationsTable');
        if (!container) return;

        const sortedData_Stations = sortStations(currentStationsSort);

        const sortArrow = (col) => {
            if (col !== currentStationsSort) return '';
            return sortDirection_Stations[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table">
<thead>
    <tr>
        <th id="sortstation" style="cursor:pointer; text-align:center;">
            Station${sortArrow('name')}
        </th>
        <th id="sortlat" style="cursor:pointer; text-align:center;">
            Lat${sortArrow('lat')}
        </th>
        <th id="sortlng" style="cursor:pointer; text-align:center;">
            Lng${sortArrow('lng')}
        </th>
        <th id="sortcount_station" style="cursor:pointer;text-align:center;">
            Count${sortArrow('count')}
        </th>
        
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_Stations.map(d => d.total), 1);

        sortedData_Stations.forEach(d => {

            const barWidth = (d.total / maxCount * 100).toFixed(0);
            html += `
<tr id="station_${d.name}">
    
    <td>
        <span style="font-weight: 300;font-size:0.7rem;" title="${d.province} ${d.city}">${d.name}</span>
    </td>
    <td>
        <span style="font-weight: 300;font-size:0.7rem;">${d.lat.toFixed(2)}</span>
    </td>
    <td>
        <span style="font-weight: 300;font-size:0.7rem;">${d.lng.toFixed(2)}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.total}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';




        container.innerHTML = html;

        sortedData_Stations.forEach(d => {
            document.getElementById(`station_${d.name}`).addEventListener('mouseenter', function () {
                const mapFrame = document.getElementById("map2Iframe");
                mapFrame.contentWindow.postMessage({
                    type: "highlight_station",
                    station: d.name
                }, window.location.origin);
            });
        });
        document.getElementById('sortstation').addEventListener('click', () => renderStationsTable('name'));
        document.getElementById('sortlng').addEventListener('click', () => renderStationsTable('lng'));

        document.getElementById('sortlat').addEventListener('click', () => renderStationsTable('lat'));
        document.getElementById('sortcount_station').addEventListener('click', () => renderStationsTable('count'));
    }

    function getRailCityStats() {
        return (railAreaData?.cities || [])
            .filter(row => (row.visited_stations || 0) > 0).map(row => ({
            name: row.city,
            province: row.province,
            total: row.visits || 0,
            visitedStations: row.visited_stations || 0,
            totalStations: row.total_stations || 0
        }));
    }

    // ========== 城市统计 ==========

    let currentTrainCitiesSort = 'count';    // count, city, prov
    let TrainCitiesData = [];
    let sortDirection_TrainCities = {};  // 记录每个列的排序方向

    // 修改排序函数
    function sortTrainCities(sortBy) {
        if (sortDirection_TrainCities[sortBy] === undefined) {
            sortDirection_TrainCities[sortBy] = 'desc';
        } else {
            sortDirection_TrainCities[sortBy] = sortDirection_TrainCities[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection_TrainCities[sortBy];

        return [...TrainCitiesData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.total - b.total;
                    break;
                case 'city':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'stations':
                    comparison = (a.visitedStations / Math.max(a.totalStations, 1))
                        - (b.visitedStations / Math.max(b.totalStations, 1));
                    break;
                case 'prov':
                    comparison = a.province.localeCompare(b.province);
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderTrainCitiesTable(sortby) {
        currentTrainCitiesSort = sortby;
        const container = document.getElementById('TrainCitiesTable');
        if (!container) return;

        const sortedData_TrainCities = sortTrainCities(currentTrainCitiesSort);

        const sortArrow = (col) => {
            if (col !== currentTrainCitiesSort) return '';
            return sortDirection_TrainCities[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table rail-area-table">
<thead>
    <tr>
        <th id="sortprov" title="省级地区" style="cursor:pointer; text-align:center;">
            省${sortArrow('prov')}
        </th>
        <th id="sortcity" title="铁路可到访城市" style="cursor:pointer; text-align:center;">
            城市${sortArrow('city')}
        </th>
        <th id="sortstations_city" title="到访火车站 / 该城市可乘火车站" style="cursor:pointer;text-align:center;">
            站点${sortArrow('stations')}
        </th>
        <th id="sortcount_city" title="上下车累计次数" style="cursor:pointer;text-align:center;">
            次数${sortArrow('count')}
        </th>
        
    </tr>
</thead>
<tbody>
    `;


        const maxCount = Math.max(...sortedData_TrainCities.map(d => d.total), 1);

        sortedData_TrainCities.forEach(d => {

            const barWidth = (d.total / maxCount * 100).toFixed(0);
            html += `
<tr id="city_${d.name}">
    <td style="text-align: center;" >
        <span style="font-weight: 300;font-size:0.7rem;">${d.province}</span>
    </td>
    <td>
        <span style="font-weight: 300;font-size:0.7rem;">${d.name}</span>
    </td>
    <td class="rail-fraction" title="到访 ${d.visitedStations} 个 / 共 ${d.totalStations} 个可乘火车站">
        <strong>${d.visitedStations}</strong><span>/${d.totalStations}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.total}
    </td>
    
</tr>
        `;

        });

        html += '</tbody></table>';




        container.innerHTML = html;
        sortedData_TrainCities.forEach(d => {
            document.getElementById(`city_${d.name}`).addEventListener("mouseenter", function () {
                let mapFrame = document.getElementById("map2Iframe");
                mapFrame.contentWindow.postMessage({
                    type: "highlight_city",
                    city: d.name
                }, window.location.origin);
            });
        });

        document.getElementById('sortprov').addEventListener('click', () => renderTrainCitiesTable('prov'));
        document.getElementById('sortcity').addEventListener('click', () => renderTrainCitiesTable('city'));
        document.getElementById('sortstations_city').addEventListener('click', () => renderTrainCitiesTable('stations'));
        document.getElementById('sortcount_city').addEventListener('click', () => renderTrainCitiesTable('count'));
    }

    // ========== 省份统计 ==========

    let currentRailProvincesSort = 'count';
    let RailProvincesData = [];
    let sortDirection_RailProvinces = {};

    function getRailProvinceStats() {
        return (railAreaData?.provinces || []).map(row => ({
            name: row.province,
            visitedCities: row.visited_cities || 0,
            totalCities: row.total_cities || 0,
            visitedStations: row.visited_stations || 0,
            totalStations: row.total_stations || 0,
            total: row.visits || 0
        }));
    }

    function sortRailProvinces(sortBy) {
        if (sortDirection_RailProvinces[sortBy] === undefined) {
            sortDirection_RailProvinces[sortBy] = 'desc';
        } else {
            sortDirection_RailProvinces[sortBy] = sortDirection_RailProvinces[sortBy] === 'desc' ? 'asc' : 'desc';
        }
        const direction = sortDirection_RailProvinces[sortBy];
        return [...RailProvincesData].sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
            else if (sortBy === 'cities') comparison = (a.visitedCities / Math.max(a.totalCities, 1)) - (b.visitedCities / Math.max(b.totalCities, 1));
            else if (sortBy === 'stations') comparison = a.visitedStations - b.visitedStations;
            else comparison = a.total - b.total;
            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderRailProvincesTable(sortBy) {
        currentRailProvincesSort = sortBy;
        const container = document.getElementById('RailProvincesTable');
        if (!container) return;
        const sorted = sortRailProvinces(sortBy);
        const sortArrow = col => col === currentRailProvincesSort
            ? (sortDirection_RailProvinces[col] === 'asc' ? ' ▲' : ' ▼')
            : '';
        const maxCount = Math.max(...sorted.map(row => row.total), 1);
        container.innerHTML = `
            <table class="type-table rail-area-table">
                <thead><tr>
                    <th id="sortprovince_name" title="省级地区">省份${sortArrow('name')}</th>
                    <th id="sortprovince_cities" title="到访城市 / 该省可乘火车到达的城市">城市${sortArrow('cities')}</th>
                    <th id="sortprovince_stations" title="到访火车站数；悬浮可查看全省可乘火车站总数">车站${sortArrow('stations')}</th>
                    <th id="sortprovince_count" title="上下车累计次数">次数${sortArrow('count')}</th>
                </tr></thead>
                <tbody>${sorted.map(row => `
                    <tr id="province_${row.name}">
                        <td><span title="${row.name}">${row.name}</span></td>
                        <td class="rail-fraction" title="到访 ${row.visitedCities} 个 / 共 ${row.totalCities} 个铁路城市"><strong>${row.visitedCities}</strong><span>/${row.totalCities}</span></td>
                        <td class="rail-number" title="到访 ${row.visitedStations} 个 / 共 ${row.totalStations} 个可乘火车站">${row.visitedStations}</td>
                        <td class="rail-number">${row.total}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
        sorted.forEach(row => {
            document.getElementById(`province_${row.name}`)?.addEventListener('mouseenter', () => {
                document.getElementById('map2Iframe')?.contentWindow?.postMessage({
                    type: 'highlight_prov',
                    prov: row.name
                }, window.location.origin);
            });
        });
        document.getElementById('sortprovince_name').addEventListener('click', () => renderRailProvincesTable('name'));
        document.getElementById('sortprovince_cities').addEventListener('click', () => renderRailProvincesTable('cities'));
        document.getElementById('sortprovince_stations').addEventListener('click', () => renderRailProvincesTable('stations'));
        document.getElementById('sortprovince_count').addEventListener('click', () => renderRailProvincesTable('count'));
    }

    // ========== 车型统计 ==========
    
    let currentTrainSort = 'count';    // count, rarity, name
    let trainTypeData = [];
    let sortDirection = {};  // 记录每个列的排序方向

    function getTrainTypeStats() {
        if (!chartsData || !chartsData.model) return [];

        const modelData = chartsData.model;
        const totalTrips = Object.values(modelData).reduce((sum, m) => sum + (m.total || 0), 0);

        return Object.entries(modelData).map(([modelName, modelInfo]) => {
            // 直接用你定义的稀有度
            const rarityLevel = modelInfo.rarity || '普通';

            // 根据稀有度等级分配样式类
            let rarityClass;
            switch (rarityLevel) {
                case '传说':
                    rarityClass = 'rarity-legendary';
                    break;
                case '史诗':
                    rarityClass = 'rarity-epic';
                    break;
                case '稀有':
                    rarityClass = 'rarity-rare';
                    break;
                default:
                    rarityClass = 'rarity-common';
            }

            // 稀有度排序权重（越小越稀有）
            const rarityWeight = {
                '传说': 1,
                '史诗': 2,
                '稀有': 3,
                '普通': 4
            };

            return {
                type: modelName,
                count: modelInfo.total || 0,
                percentage: modelInfo.rate * 100,
                rarityLevel: rarityLevel,
                rarityClass: rarityClass,
                rarityWeight: rarityWeight[rarityLevel] || 5
            };
        });
    }

    // 修改排序函数
    function sortTrainTypes(sortBy) {
        if (sortDirection[sortBy] === undefined) {
            sortDirection[sortBy] = 'desc';
        } else {
            sortDirection[sortBy] = sortDirection[sortBy] === 'desc' ? 'asc' : 'desc';
        }

        const direction = sortDirection[sortBy];

        return [...trainTypeData].sort((a, b) => {
            let comparison;

            switch (sortBy) {
                case 'count':
                    comparison = a.count - b.count;
                    break;
                case 'rarity':
                    // 稀有度权重小的排前面
                    comparison = b.rarityWeight - a.rarityWeight;
                    break;
                case 'name':
                    comparison = a.type.localeCompare(b.type);
                    break;
                case 'percentage':
                    comparison = a.percentage - b.percentage;
                    break;
                default:
                    comparison = 0;
            }

            return direction === 'asc' ? comparison : -comparison;
        });
    }

    function renderTrainTypeTable(sortby) {
        currentTrainSort = sortby;
        const container = document.getElementById('trainTypeTable');
        if (!container) return;

        const sortedData = sortTrainTypes(currentTrainSort);

        const sortArrow = (col) => {
            if (col !== currentTrainSort) return '';
            return sortDirection[col] === 'asc' ? ' ▲' : ' ▼';
        };

        let html = `
        <table class="type-table" id="train-type-table">
<thead>
    <tr>
        <th id="sortname" style="cursor:pointer;">
            车型${sortArrow('name')}
        </th>
        <th id="sortcount" style="cursor:pointer; text-align:center;">
            次数${sortArrow('count')}
        </th>
        <th id="sortrarity" style="cursor:pointer; text-align:center;">
            稀有度${sortArrow('rarity')}
        </th>
        <th id="sortpercentage" style="cursor:pointer; text-align:right;">
            稀有度${sortArrow('percentage')}
        </th>
    </tr>
</thead>
<tbody>
    `;
        

        const maxCount = Math.max(...sortedData.map(d => d.count), 1);

        sortedData.forEach(d => {

            const barWidth = (d.count / maxCount * 100).toFixed(0);
            const NA = "N/A";
            html += `
<tr>
    <td>
        <span style="font-weight: 500;">${d.type}</span>
    </td>
    <td style="text-align: center; font-weight: 500;">
        ${d.count}
        <div class="rarity-bar-container">
            <div class="rarity-bar" style="width: ${barWidth}%; background: #e94560;"></div>
        </div>
    </td>
    <td style="text-align: center;">
        <span class="rarity-badge ${d.rarityClass}">${d.rarityLevel}</span>
    </td>
    <td style="text-align: right; color: rgba(255,255,255,0.5);">
        ${d.percentage ? d.percentage.toFixed(1):NA}%
    </td>
</tr>
        `;
            
        });

        html += '</tbody></table>';

        html += `
        <div style="margin-top: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-align: center;">
共打卡 ${sortedData.filter(item => item.count !== 0).length}/${sortedData.length} 种车型
        </div>
        
    `;
        [['rarity-legendary', '传说'], ['rarity-epic', '史诗'], ['rarity-rare', '稀有'], ['rarity-common', '普通']].forEach(([c, l]) => {   
            html += `
            <div style="margin-top: 10px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-align: center;">
        <span class="rarity-badge ${c}">${l}</span> ${sortedData.filter(item => item.rarityClass === c && item.count !== 0).length}/${sortedData.filter(item => item.rarityClass === c).length} 
        </div>
            `;
        });
        

        container.innerHTML = html;
        document.getElementById('sortname').addEventListener('click', () => renderTrainTypeTable('name'));
        document.getElementById('sortcount').addEventListener('click', () => renderTrainTypeTable('count'));
        document.getElementById('sortrarity').addEventListener('click', () => renderTrainTypeTable('rarity'));
        document.getElementById('sortpercentage').addEventListener('click', () => renderTrainTypeTable('percentage'));
    }

    


    // ========== clear popup ==========
    let hide = true;
    function clearpopup() {
        [["topStationsPopup", '[data-action="most-visited-station"]'], ["topCitiesPopup", '[data-action="most-visited-city"]'], ["topProvsPopup", '[data-action="most-visited-prov"]'],
            ["topTravelCitiesPopup", '[data-action="travel-most-visited-city"]'], ["topTravelForeignCitiesPopup", '[data-action="travel-most-visited-foreign-city"]'],
            ["topTravelCountriesPopup", '[data-action="travel-most-visited-country"]'], ["topAirportsPopup", '[data-action="travel-most-visited-airport"]']].forEach(([p, c]) => {
            let pup = document.getElementById(p);
            if (pup && pup.style.display != "none") {
                hide = true;
                pup.style.display = 'none';
                let cd = document.querySelector(c);
                if (!cd) return;
                cd.style.background = '';
                cd.style.border = '';

            }
        })
    }

    // ========== Most Visited Station 悬浮事件 ==========

    // 计算 Top 5 车站
    function getTopStations() {
        if (!chartsData || !chartsData.stationcount) return [];

        const stations = Object.entries(chartsData.stationcount)
            .map(([name, data]) => ({
                name,
                total: data.total || 0,
                on: data.on || 0,
                off: data.off || 0,
                lat: data.lat || 0,
                lng: data.lng || 0,
                bureau: data.bureau || '',
                city: data.city || '',
                province: data.province ||''
            }))
            .sort((a, b) => b.total - a.total);

        return stations;
    }

    function initMostVisitedStationHover() {
        const card = document.querySelector('[data-action="most-visited-station"]');
        const popup = document.getElementById('topStationsPopup');

        if (!card || !popup) return;

        let hideTimeout;

       

        // 生成列表 HTML
        function init_renderTopStationsList(stations) {

            document.getElementById('topStationsList').innerHTML = '';
            stations.forEach((station, index) => {
                let rankClass = 'normal';
                if (index === 0) rankClass = 'top-1';
                else if (index === 1) rankClass = 'top-2';
                else if (index === 2) rankClass = 'top-3';

                document.getElementById('topStationsList').innerHTML += `<div class="top-item" id="topstation_${station.name}">
                                    <span class="top-rank ${rankClass}">${index + 1}</span>
                                    <span class="top-name" title="${station.name} (${station.bureau})">${station.name}</span>
                                    <span class="top-count">${station.total}次</span>
                                </div>
                                `;
            });
            stations.forEach((station, index) => {
                let top_card = document.getElementById(`topstation_${station.name}`);
                top_card.addEventListener('mouseenter', function (e) {
                    top_card.style.background = 'rgba(0,255,255,0.08)';
                    const mapFrame = document.getElementById("map2Iframe");
                    mapFrame.contentWindow.postMessage({
                        type: "highlight_station",
                        station: station.name
                    }, window.location.origin);
                });

                top_card.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        top_card.style.background = '';
                    }, 150);
                });
            })
            return;
        }

        // 获取 Top 5 数据
        const topStations = getTopStations().slice(0,5);
        if (topStations.length > 0) {
            // 渲染列表
            init_renderTopStationsList(topStations);
        }

        // 定位弹出列表
        function positionPopup(cardRect) {
            const popupWidth = popup.offsetWidth || 220;
            const popupHeight = popup.offsetHeight || 200;

            // 默认显示在卡片右侧
            let left = cardRect.left - popupWidth - 12;
            let top = cardRect.top + (cardRect.height - popupHeight) / 2;



            // 确保不超出屏幕
            top = Math.max(10, Math.min(window.innerHeight - popupHeight - 10, top));

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
        }

        card.addEventListener('mouseenter', function (e) {

            clearpopup();

            // 清除隐藏定时器
            clearTimeout(hideTimeout);

            // 高亮卡片
            card.style.background = 'rgba(233, 69, 96, 0.15)';
            card.style.border = '1px solid rgba(233, 69, 96, 0.4)';
            card.style.cursor = 'pointer';




            if (topStations.length > 0) {

                // 定位弹出列表
                const cardRect = card.getBoundingClientRect();
                popup.style.display = 'block';

                // 先显示再定位（需要获取实际尺寸）
                requestAnimationFrame(() => {
                    positionPopup(cardRect);
                });


            }
        });


        hide = true;
        card.addEventListener('mouseleave', function () {
            // 延迟隐藏，防止快速划过闪烁
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    // 恢复卡片样式
                    card.style.background = '';
                    card.style.border = '';

                    // 隐藏弹出列表
                    popup.style.display = 'none';


                }, 150);
            }

        });

        // 弹出列表本身也能保持显示 点击or移入

        card.addEventListener('click', function () {
            hide = !hide;
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });

        popup.addEventListener('mouseenter', function () {
            clearTimeout(hideTimeout);
        });

        popup.addEventListener('mouseleave', function () {
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });


    }


    // ========== Most Visited City 悬浮事件 ==========

    // 计算 Top 5 城市
    function getTopCities() {
        if (!chartsData || !chartsData.stationcount) return [];

        const cityStats = {};

        Object.entries(chartsData.stationcount).forEach(([name, data]) => {
            const city = data.city || '未知城市';

            if (!cityStats[city]) {
                cityStats[city] = {
                    name: city,
                    province: data.province || '',
                    total: 0,
                    on: 0,
                    off: 0,
                    stations: []  // 该城市的车站列表
                };
            }

            cityStats[city].total += data.total || 0;
            cityStats[city].on += data.on || 0;
            cityStats[city].off += data.off || 0;
            cityStats[city].stations.push(name);
        });

        // 排序取 Top 5
        const topCities = Object.values(cityStats)
            .sort((a, b) => b.total - a.total);

        return topCities;
    }

    function initMostVisitedCityHover() {
        const card = document.querySelector('[data-action="most-visited-city"]');
        const popup = document.getElementById('topCitiesPopup');

        if (!card || !popup) return;

        let hideTimeout;

        

        // 生成列表 HTML
        function init_renderTopCitiesList(cities) {

            document.getElementById('topCitiesList_railway').innerHTML = '';
            cities.forEach((city, index) => {
                let rankClass = 'normal';
                if (index === 0) rankClass = 'top-1';
                else if (index === 1) rankClass = 'top-2';
                else if (index === 2) rankClass = 'top-3';

                document.getElementById('topCitiesList_railway').innerHTML += `<div class="top-item" id="topcity_${city.name}">
                                    <span class="top-rank ${rankClass}">${index + 1}</span>
                                    <span class="top-name" title="${city.name} stations:${city.stations.length}">${city.name}</span>
                                    <span class="top-count">${city.total}次</span>
                                </div>
                                `;
            });
            cities.forEach((city, index) => {
                let top_card = document.getElementById(`topcity_${city.name}`);
                top_card.addEventListener('mouseenter', function (e) {
                    top_card.style.background = 'rgba(0,255,255,0.08)';
                    let mapFrame = document.getElementById("map2Iframe");
                    mapFrame.contentWindow.postMessage({
                        type: "highlight_city",
                        city: city.name
                    }, window.location.origin);
                });

                top_card.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        top_card.style.background = '';
                    }, 150);
                });
            })
            return;
        }

        // 获取 Top 5 数据
        const topCities = getTopCities().slice(0,5);
        if (topCities.length > 0) {
            // 渲染列表
            init_renderTopCitiesList(topCities);
        }

        // 定位弹出列表
        function positionPopup(cardRect) {
            const popupWidth = popup.offsetWidth || 220;
            const popupHeight = popup.offsetHeight || 200;

            // 默认显示在卡片右侧
            let left = cardRect.left - popupWidth - 12;
            let top = cardRect.top + (cardRect.height - popupHeight) / 2;



            // 确保不超出屏幕
            top = Math.max(10, Math.min(window.innerHeight - popupHeight - 10, top));

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
        }

        card.addEventListener('mouseenter', function (e) {

            clearpopup();
            // 清除隐藏定时器
            clearTimeout(hideTimeout);

            // 高亮卡片
            card.style.background = 'rgba(233, 69, 96, 0.15)';
            card.style.border = '1px solid rgba(233, 69, 96, 0.4)';
            card.style.cursor = 'pointer';




            if (topCities.length > 0) {

                // 定位弹出列表
                const cardRect = card.getBoundingClientRect();
                popup.style.display = 'block';

                // 先显示再定位（需要获取实际尺寸）
                requestAnimationFrame(() => {
                    positionPopup(cardRect);
                });


            }
        });


        hide = true;
        card.addEventListener('mouseleave', function () {
            // 延迟隐藏，防止快速划过闪烁
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    // 恢复卡片样式
                    card.style.background = '';
                    card.style.border = '';

                    // 隐藏弹出列表
                    popup.style.display = 'none';


                }, 150);
            }

        });

        // 弹出列表本身也能保持显示 点击or移入

        card.addEventListener('click', function () {
            hide = !hide;
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });

        popup.addEventListener('mouseenter', function () {
            clearTimeout(hideTimeout);
        });

        popup.addEventListener('mouseleave', function () {
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });


    }


    // ========== Most Visited Prov 悬浮事件 ==========
    function initMostVisitedProvHover() {
        const card = document.querySelector('[data-action="most-visited-prov"]');
        const popup = document.getElementById('topProvsPopup');

        if (!card || !popup) return;

        let hideTimeout;

        // 计算 Top 5 城市
        function getTopProvs() {
            if (!chartsData || !chartsData.stationcount) return [];

            const provStats = {};

            Object.entries(chartsData.stationcount).forEach(([name, data]) => {
                const prov = data.province || '未知省';

                if (!provStats[prov]) {
                    provStats[prov] = {
                        name: prov,
                        total: 0,
                        on: 0,
                        off: 0,
                        stations: []  // 该省份的车站列表
                    };
                }

                provStats[prov].total += data.total || 0;
                provStats[prov].on += data.on || 0;
                provStats[prov].off += data.off || 0;
                provStats[prov].stations.push(name);
            });

            // 排序取 Top 5
            const topProvs = Object.values(provStats)
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

            return topProvs;
        }

        // 生成列表 HTML
        function init_renderTopProvsList(provs) {

            document.getElementById('topProvsList_railway').innerHTML = '';
            provs.forEach((prov, index) => {
                let rankClass = 'normal';
                if (index === 0) rankClass = 'top-1';
                else if (index === 1) rankClass = 'top-2';
                else if (index === 2) rankClass = 'top-3';

                document.getElementById('topProvsList_railway').innerHTML += `<div class="top-item" id="topprov_${prov.name}">
                                    <span class="top-rank ${rankClass}">${index + 1}</span>
                                    <span class="top-name" title="${prov.name} stations:${prov.stations.length}">${prov.name}</span>
                                    <span class="top-count">${prov.total}次</span>
                                </div>
                                `;
            });
            provs.forEach((prov, index) => {
                let top_card = document.getElementById(`topprov_${prov.name}`);
                top_card.addEventListener('mouseenter', function (e) {
                    top_card.style.background = 'rgba(0,255,255,0.08)';
                    let mapFrame = document.getElementById("map2Iframe");
                    mapFrame.contentWindow.postMessage({
                        type: "highlight_prov",
                        prov: prov.name
                    }, window.location.origin);
                });

                top_card.addEventListener('mouseleave', function () {
                    // 延迟隐藏，防止快速划过闪烁
                    setTimeout(() => {
                        // 恢复卡片样式
                        top_card.style.background = '';
                    }, 150);
                });
            })
            return;
        }

        // 获取 Top 5 数据
        const topProvs = getTopProvs();
        if (topProvs.length > 0) {
            // 渲染列表
            init_renderTopProvsList(topProvs);
        }

        // 定位弹出列表
        function positionPopup(cardRect) {
            const popupWidth = popup.offsetWidth || 220;
            const popupHeight = popup.offsetHeight || 200;

            // 默认显示在卡片右侧
            let left = cardRect.left - popupWidth - 12;
            let top = cardRect.top + (cardRect.height - popupHeight) / 2;



            // 确保不超出屏幕
            top = Math.max(10, Math.min(window.innerHeight - popupHeight - 10, top));

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
        }

        card.addEventListener('mouseenter', function (e) {

            clearpopup();
            // 清除隐藏定时器
            clearTimeout(hideTimeout);

            // 高亮卡片
            card.style.background = 'rgba(233, 69, 96, 0.15)';
            card.style.border = '1px solid rgba(233, 69, 96, 0.4)';
            card.style.cursor = 'pointer';




            if (topProvs.length > 0) {

                // 定位弹出列表
                const cardRect = card.getBoundingClientRect();
                popup.style.display = 'block';

                // 先显示再定位（需要获取实际尺寸）
                requestAnimationFrame(() => {
                    positionPopup(cardRect);
                });


            }
        });


        hide = true;
        card.addEventListener('mouseleave', function () {
            // 延迟隐藏，防止快速划过闪烁
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    // 恢复卡片样式
                    card.style.background = '';
                    card.style.border = '';

                    // 隐藏弹出列表
                    popup.style.display = 'none';


                }, 150);
            }

        });

        // 弹出列表本身也能保持显示 点击or移入

        card.addEventListener('click', function () {
            hide = !hide;
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });

        popup.addEventListener('mouseenter', function () {
            clearTimeout(hideTimeout);
        });

        popup.addEventListener('mouseleave', function () {
            if (!hide) clearTimeout(hideTimeout);
            else {
                hideTimeout = setTimeout(() => {
                    card.style.background = '';
                    card.style.border = '';
                    popup.style.display = 'none';

                }, 150);
            }
        });


    }

    // ========== 浮动散点图 ==========
    function drawFloatingScatter() {
        const canvas = document.getElementById('floatingScatterChart');
        if (!canvas || !chartsData) return;

        const ctx = canvas.getContext('2d');
        if (floatingScatterChart) floatingScatterChart.destroy();

        const rides = chartsData.rides || [];
        const groups = {};

        if (currentScatterType === 'time') {
            rides.forEach(r => {
                const g = getTrainGroup(r.train);
                if (!groups[g]) groups[g] = [];
                groups[g].push({ x: hmToFloat(r.on), y: hmToFloat(r.off), r: Math.max(4, (r.duration || 30) / 35), _ride: r });
            });

            floatingScatterChart = new Chart(ctx, {
                type: 'bubble',
                data: { datasets: Object.keys(groups).map(g => ({ label: g, data: groups[g], backgroundColor: colorForGroup(g) })) },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    scales: {
                        x: { min: 0, max: 24, title: { display: true, text: '出发时间', color: '#fff' }, ticks: { color: '#fff' } },
                        y: { min: 0, max: 24, title: { display: true, text: '到达时间', color: '#fff' }, ticks: { color: '#fff' } }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff',
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const ride = ctx.raw._ride;
                                    const mapFrame = document.getElementById("map2Iframe");
                                    mapFrame.contentWindow.postMessage({
                                        type: "highlight_train",
                                        train: ride.train
                                    }, window.location.origin);
                                    return `Train:${ride.train} From:${ride.from} To:${ride.to} on:${ride.on} off:${ride.off} duration:${ride.duration}min`;
                                }
                            }
                        },
                        zoom: {
                            zoom: {
                                wheel: {
                                    enabled: true,  // 启用鼠标滚轮缩放
                                    speed: 0.2      // 缩放速度
                                },
                                pinch: {
                                    enabled: true    // 触摸板手势缩放
                                },
                                mode: 'xy',          // 同时在x和y方向缩放
                            },
                            pan: {
                                enabled: true,       // 启用平移
                                mode: 'xy',          // 可向任意方向平移
                                threshold: 10,
                                modifierKey: null  // 不需要按辅助键
                            },
                            limits: {
                                x: {
                                    min: 0,        // 最小经度限制
                                    max: 24,        // 最大经度限制
                                    minRange: 3       // 最小缩放范围（最小能放大到5度范围）
                                },
                                y: {
                                    min: 0,
                                    max: 24,
                                    minRange: 3       // 最小缩放范围（最小能放大到3度范围）
                                }
                            }
                        }
                    }
                }
            });
        } else if (currentScatterType === 'distance') {
            rides.forEach(r => {
                const g = getTrainGroup(r.train);
                if (!groups[g]) groups[g] = [];
                groups[g].push({ x: r.distance || 0, y: r.duration || 0, r: 4, _ride: r });
            });

            floatingScatterChart = new Chart(ctx, {
                type: 'bubble',
                data: { datasets: Object.keys(groups).map(g => ({ label: g, data: groups[g], backgroundColor: colorForGroup(g) })) },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    scales: {
                        x: { title: { display: true, text: '距离 (km)', color: '#fff' }, ticks: { color: '#fff' } },
                        y: { title: { display: true, text: '时长 (min)', color: '#fff' }, ticks: { color: '#fff' } }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff',
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const ride = ctx.raw._ride;
                                    const mapFrame = document.getElementById("map2Iframe");
                                    mapFrame.contentWindow.postMessage({
                                        type: "highlight_train",
                                        train: ride.train
                                    }, window.location.origin);
                                    return `Train:${ride.train} From:${ride.from} To:${ride.to} distance:${ride.distance}km duration:${ride.duration}min`;
                                }
                            }
                        },
                        zoom: {
                            zoom: {
                                wheel: {
                                    enabled: true,  // 启用鼠标滚轮缩放
                                    speed: 0.2      // 缩放速度
                                },
                                pinch: {
                                    enabled: true    // 触摸板手势缩放
                                },
                                mode: 'xy',          // 同时在x和y方向缩放
                            },
                            pan: {
                                enabled: true,       // 启用平移
                                mode: 'xy',          // 可向任意方向平移
                                threshold: 10,
                                modifierKey: null  // 不需要按辅助键
                            },
                            limits: {
                                x: {
                                    min: 0,
                                    max: 2400,
                                    minRange: 100
                                },
                                y: {
                                    min: 0,
                                    max: 1400,
                                    minRange: 70
                                }
                            }
                        }
                    }
                }
            });
        } else if (currentScatterType === 'station') {
            const stationcount = chartsData.stationcount || {};
            Object.entries(stationcount).forEach(([name, s]) => {
                const g = s.bureau || '其他';
                if (!groups[g]) groups[g] = [];
                groups[g].push({ x: s.lng || 0, y: s.lat || 0, r: Math.max(4, (s.total || 1) * 1.5), _station: s, name });
            });

            floatingScatterChart = new Chart(ctx, {
                type: 'bubble',
                data: { datasets: Object.keys(groups).map(g => ({ label: g, data: groups[g], backgroundColor: colorForGroup(g) })) },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    scales: {
                        x: { title: { display: true, text: '经度', color: '#fff' }, ticks: { color: '#fff' } },
                        y: { title: { display: true, text: '纬度', color: '#fff' }, ticks: { color: '#fff' } }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff',
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const station = ctx.raw._station;
                                    const mapFrame = document.getElementById("map2Iframe");
                                    mapFrame.contentWindow.postMessage({
                                        type: "highlight_station",
                                        station: ctx.raw.name
                                    }, window.location.origin);
                                    return `Station:${ctx.raw.name} (${station.lng.toFixed(2)},${station.lat.toFixed(2)}) on:${station.on} off:${station.off} total:${station.total}`;
                                }
                            }
                        },
                        zoom: {
                            zoom: {
                                wheel: {
                                    enabled: true,  // 启用鼠标滚轮缩放
                                    speed: 0.2      // 缩放速度
                                },
                                pinch: {
                                    enabled: true    // 触摸板手势缩放
                                },
                                mode: 'xy',          // 同时在x和y方向缩放
                            },
                            pan: {
                                enabled: true,       // 启用平移
                                mode: 'xy',          // 可向任意方向平移
                                threshold: 10,
                                modifierKey: null  // 不需要按辅助键
                            },
                            limits: {
                                x: {
                                    min: 100,        // 最小经度限制
                                    max: 125,        // 最大经度限制
                                    minRange: 3       // 最小缩放范围（最小能放大到5度范围）
                                },
                                y: {
                                    min: 20,
                                    max: 45,
                                    minRange: 1.5       // 最小缩放范围（最小能放大到3度范围）
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // ========== 浮动直方图 ==========
    function drawFloatingHist() {
        const canvas = document.getElementById('floatingHistChart');
        if (!canvas || !chartsData) return;

        const ctx = canvas.getContext('2d');
        if (floatingHistChart) floatingHistChart.destroy();

        const binSize = currentHistType === 'duration' ? 30 : 100;
        const maxBin = currentHistType === 'duration' ? 600 : 2000;
        const data = currentHistType === 'duration' ? chartsData.durations : chartsData.distances;

        if (!data) return;

        const bins = new Array(maxBin / binSize + 1).fill(0);
        data.forEach(d => {
            if (d >= maxBin) bins[bins.length - 1]++;
            else bins[Math.floor(d / binSize)]++;
        });

        const labels = [];
        for (let i = 0; i < bins.length - 1; i++) labels.push(`${i * binSize}-${(i + 1) * binSize}`);
        labels.push(`${maxBin}+`);

        floatingHistChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: currentHistType === 'duration' ? 'Travel Duration' : 'Travel Distance',
                    data: bins,
                    backgroundColor: '#e94560',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: {
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true,

                        callbacks: {
                            // 1) 标题：默认一般就是 x 轴对应的 label
                            title: (items) => {
                                if (!items.length) return '';
                                const item = items[0];
                                const label = item.label;
                                let start, end;
                                if (label.endsWith('+')) {
                                    start = Number(label.slice(0, -1));
                                    end = 999999;
                                }
                                else[start, end] = label.split('-').map(Number);

                                const dsLabel = item.dataset?.label ?? '';


                                const mapFrame = document.getElementById("map2Iframe");
                                mapFrame.contentWindow.postMessage({
                                    type: dsLabel,
                                    start: start,
                                    end: end
                                }, window.location.origin);


                                return item.label ?? (item.raw && item.raw.x != null ? String(item.raw.x) : '');
                            },

                            // 2) 每一行：默认是 "Dataset Label: Value"
                            label: (item) => {
                                const dsLabel = item.dataset?.label ?? '';

                                // Chart.js 已经帮你格式化了数字 -> formattedValue
                                const value = item.formattedValue ?? '';

                                // 默认如果 dsLabel 为空就只显示 value
                                return dsLabel ? `${dsLabel}: ${value}` : `${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.7)', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' }, beginAtZero: true }
                }
            }
        });
    }

    // ========== 浮动时间分布图 ==========
    function drawFloatingTimeDist() {
        const canvas = document.getElementById('floatingTimeDistChart');
        if (!canvas || !chartsData) return;

        const ctx = canvas.getContext('2d');
        if (floatingTimeDistChart) floatingTimeDistChart.destroy();

        const arriveBins = new Array(24).fill(0);
        const departBins = new Array(24).fill(0);

        (chartsData.arrive_hours || []).forEach(h => { if (h >= 0 && h < 24) arriveBins[h]++; });
        (chartsData.depart_hours || []).forEach(h => { if (h >= 0 && h < 24) departBins[h]++; });
        // 更新最早/最晚信息
        const earliestArrFloat = hmToFloat(chartsData.earliestarr.time) - 0.5;
        const latestArrFloat = hmToFloat(chartsData.latestarr.time) - 0.5;
        const earliestDepFloat = hmToFloat(chartsData.earliestdep.time) - 0.5;
        const latestDepFloat = hmToFloat(chartsData.latestdep.time) - 0.5;

        const maxArrive = Math.max(...arriveBins);
        const maxDepart = Math.max(...departBins);
        const yAxisMax = Math.ceil(Math.max(maxArrive + maxDepart) / 10) * 10;

        floatingTimeDistChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [...Array(24).keys()],
                datasets: [
                    {
                        label: "Departure",
                        data: departBins,
                        backgroundColor: '#f97316',  // 橙色
                        borderColor: '#f97316',
                        borderWidth: 1,
                        stack: 'time',  // 堆叠标识
                        order: 1,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: "Arrival",
                        data: arriveBins,
                        backgroundColor: '#3b82f6',  // 蓝色
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        stack: 'time',  // 同一个stack，实现堆叠
                        order: 2,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Time",
                            font: { size: 13, weight: '500' }
                        },
                        min: 0,
                        max: 24,
                        ticks: {
                            stepSize: 1,
                            callback: function (val) {
                                return val + ':00';
                            },
                            color: 'rgba(255,255,255,0.7)'
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },

                    y: {
                        beginAtZero: true,
                        max: yAxisMax,
                        title: {
                            display: true,
                            text: "Count",
                            font: { size: 13, weight: '500' }
                        },
                        ticks: {
                            stepSize: Math.ceil(yAxisMax / 8),
                            font: { size: 12 },
                            color: 'rgba(255,255,255,0.7)'
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Distribution of Depart/Arrive Time`,
                        font: { size: 16, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                return `${label}: ${value} 次`;
                            },
                            footer: (tooltipItems) => {
                                // 计算当前小时的总数（出发+到达）
                                const stack = tooltipItems[0]?.parsed?._stacks?.y;
                                if (stack) {
                                    const total = Object.values(stack)[0] + Object.values(stack)[1];
                                    return `total: ${total}`;
                                }
                            }

                        }
                    },
                    annotation: {
                        annotations: {
                            earliestArrLine: {
                                type: "line",
                                borderColor: "blue",
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: earliestArrFloat,
                                scaleID: "x",
                                label: {
                                    content: [
                                        `Earliest Arrival : ${chartsData.earliestarr.time}`,
                                        `Train: ${chartsData.earliestarr.train}`,
                                        `From: ${chartsData.earliestarr.from}`,
                                        `To: ${chartsData.earliestarr.to}`
                                    ],
                                    enabled: true,
                                    position: "start",
                                    backgroundColor: "rgba(59,130,246,0.7)",
                                    color: '#fff',
                                    font: { size: 10 }
                                }
                            },
                            latestArrLine: {
                                type: "line",
                                borderColor: "blue",
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: latestArrFloat,
                                scaleID: "x",
                                label: {
                                    content: [
                                        `Latest Arrival: ${chartsData.latestarr.time}`,
                                        `Train: ${chartsData.latestarr.train}`,
                                        `From: ${chartsData.latestarr.from}`,
                                        `To: ${chartsData.latestarr.to}`
                                    ],
                                    enabled: true,
                                    position: "start",
                                    backgroundColor: "rgba(59,130,246,0.7)",
                                    color: "white",
                                    font: { size: 10 }
                                }
                            },
                            earliestDepLine: {
                                type: "line",
                                borderColor: "rgb(255,50,25)",
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: earliestDepFloat,
                                scaleID: "x",
                                label: {
                                    content: [
                                        `Earliest Departure: ${chartsData.earliestdep.time}`,
                                        `Train: ${chartsData.earliestdep.train}`,
                                        `From: ${chartsData.earliestdep.from}`,
                                        `To: ${chartsData.earliestdep.to}`
                                    ],
                                    enabled: true,
                                    position: 0,
                                    backgroundColor: "rgba(255,115,22,0.7)",
                                    color: "white",
                                    font: { size: 10 }
                                }
                            },
                            latestDepLine: {
                                type: "line",
                                borderColor: "rgb(255,50,25)",
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: latestDepFloat,
                                scaleID: "x",
                                label: {
                                    content: [
                                        `Latest Departure: ${chartsData.latestdep.time}`,
                                        `Train: ${chartsData.latestdep.train}`,
                                        `From: ${chartsData.latestdep.from}`,
                                        `To: ${chartsData.latestdep.to}`
                                    ],
                                    enabled: true,
                                    position: 0,
                                    backgroundColor: "rgba(255,115,22,0.7)",
                                    color: "white",
                                    font: { size: 10 }
                                }
                            }
                        }
                    }
                }
            }

        });
    }

    // ========== 关联图状态 ==========
    // ========== 关联图状态 ==========
    let connectionChartInstance = null;
    let currentConnectionType = 'chord-directed';
    let currentCityCount = 10;

    // ========== 准备关联数据 ==========
    function prepareConnectionData(cityCount) {
        if (!chartsData || !chartsData.rides) return null;

        const cityFlow = {};

        chartsData.rides.forEach(ride => {
            const fromCity = getCityFromStation(ride.from);
            const toCity = getCityFromStation(ride.to);

            if (fromCity && toCity && fromCity !== toCity) {
                const pairKey = `${fromCity}|${toCity}`;
                cityFlow[pairKey] = (cityFlow[pairKey] || 0) + 1;
            }
        });

        const cityRank = {};
        Object.entries(cityFlow).forEach(([key, count]) => {
            const [city1, city2] = key.split('|');
            cityRank[city1] = (cityRank[city1] || 0) + count;
            cityRank[city2] = (cityRank[city2] || 0) + count;
        });

        const topCities = Object.entries(cityRank)
            .sort((a, b) => b[1] - a[1])
            .slice(0, cityCount)
            .map(([city]) => city);

        const n = topCities.length;

        // 双向矩阵（有向）
        const directedMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

        // 无向矩阵（合并两个方向）
        const undirectedMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

        Object.entries(cityFlow).forEach(([key, count]) => {
            const [from, to] = key.split('|');
            const fromIdx = topCities.indexOf(from);
            const toIdx = topCities.indexOf(to);

            if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                directedMatrix[fromIdx][toIdx] = count;
                undirectedMatrix[fromIdx][toIdx] += count;
                undirectedMatrix[toIdx][fromIdx] += count;
            }
        });

        const nodes = topCities.map((name, i) => ({
            name: name,
            value: cityRank[name],
            itemStyle: { color: getCityColor(i, n) }
        }));

        const links = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const total = undirectedMatrix[i][j];
                if (total > 0) {
                    links.push({
                        source: topCities[i],
                        target: topCities[j],
                        value: total,
                        fromValue: directedMatrix[i][j] || 0,
                        toValue: directedMatrix[j][i] || 0
                    });
                }
            }
        }

        return { nodes, links, directedMatrix, undirectedMatrix, labels: topCities };
    }

    // ========== 获取车站所在城市 ==========
    function getCityFromStation(stationName) {
        if (!chartsData || !chartsData.stationcount) return stationName;
        const station = chartsData.stationcount[stationName];
        if (station && station.city) return station.city;
        return stationName;
    }

    // ========== 获取城市颜色 ==========
    function getCityColor(index, total) {
        const hue = (index / total) * 360;
        return `hsl(${hue}, 65%, 50%)`;
    }

    // ========== D3 有向和弦图 ==========
    function drawDirectedChord(data) {
        const container = document.getElementById('connectionChart');
        if (!container) return;
        container.innerHTML = '';

        const { labels, directedMatrix } = data;
        const n = labels.length;

        const width = container.clientWidth || 550;
        const height = container.clientHeight || 550;
        const outerRadius = Math.min(width, height) * 0.38;
        const innerRadius = outerRadius * 0.92;

        const svg = d3.select('#connectionChart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [-width / 2, -height / 2, width, height]);

        const color = d3.scaleOrdinal()
            .domain(d3.range(n))
            .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), n));

        const chord = d3.chord()
            .padAngle(0.03)
            .sortSubgroups(d3.descending)
            .sortChords(d3.descending)(directedMatrix);

        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const ribbon = d3.ribbon()
            .radius(innerRadius - 1);

        // 外圈
        const group = svg.append('g')
            .selectAll('g')
            .data(chord.groups)
            .join('g');

        group.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.index))
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                svg.selectAll('.ribbon-path')
                    .attr('opacity', r => r.source.index === d.index || r.target.index === d.index ? 0.9 : 0.06);
            })
            .on('mouseleave', () => svg.selectAll('.ribbon-path').attr('opacity', 0.5));

        // 标签
        group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', d => d.angle > Math.PI ? '1.2em' : '-0.4em')
            .attr('transform', d => `
rotate(${(d.angle * 180 / Math.PI - 90)})
translate(${outerRadius + 14})
${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .attr('fill', '#fff')
            .attr('font-size', '12px')
            .text(d => labels[d.index]);

        // 数值
        group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', d => d.angle > Math.PI ? '-0.2em' : '1em')
            .attr('transform', d => `
rotate(${(d.angle * 180 / Math.PI - 90)})
translate(${outerRadius + 20})
${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .attr('fill', 'rgba(255,255,255,0.5)')
            .attr('font-size', '9px')
            .text(d => d.value + '次');

        // 连线
        svg.append('g')
            .selectAll('path')
            .data(chord)
            .join('path')
            .attr('class', 'ribbon-path')
            .attr('d', ribbon)
            .attr('fill', d => color(d.source.index))
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.5)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 0.9).attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 1.5);
                showChordTooltip(event, {
                    source: labels[d.source.index],
                    target: labels[d.target.index],
                    fromTo: directedMatrix[d.source.index][d.target.index],
                    toFrom: directedMatrix[d.target.index][d.source.index]
                });
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.5).attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 0.5);
                hideChordTooltip();
            });

        container._d3Svg = svg;
    }

    // ========== D3 无向和弦图 ==========
    function drawUndirectedChord(data) {
        const container = document.getElementById('connectionChart');
        if (!container) return;
        container.innerHTML = '';

        const { labels, undirectedMatrix } = data;
        const n = labels.length;

        const width = container.clientWidth || 550;
        const height = container.clientHeight || 550;
        const outerRadius = Math.min(width, height) * 0.38;
        const innerRadius = outerRadius * 0.92;

        const svg = d3.select('#connectionChart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [-width / 2, -height / 2, width, height]);

        const color = d3.scaleOrdinal()
            .domain(d3.range(n))
            .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), n));

        const chord = d3.chord()
            .padAngle(0.03)
            .sortSubgroups(d3.descending)
            .sortChords(d3.descending)(undirectedMatrix);

        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);

        const ribbon = d3.ribbon()
            .radius(innerRadius - 1);

        const group = svg.append('g')
            .selectAll('g')
            .data(chord.groups)
            .join('g');

        group.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.index))
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                svg.selectAll('.ribbon-path')
                    .attr('opacity', r => r.source.index === d.index || r.target.index === d.index ? 0.9 : 0.06);
            })
            .on('mouseleave', () => svg.selectAll('.ribbon-path').attr('opacity', 0.5));

        group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', d => d.angle > Math.PI ? '1.2em' : '-0.4em')
            .attr('transform', d => `
rotate(${(d.angle * 180 / Math.PI - 90)})
translate(${outerRadius + 14})
${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .attr('fill', '#fff')
            .attr('font-size', '12px')
            .text(d => labels[d.index]);

        group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', d => d.angle > Math.PI ? '-0.2em' : '1em')
            .attr('transform', d => `
rotate(${(d.angle * 180 / Math.PI - 90)})
translate(${outerRadius + 20})
${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .attr('fill', 'rgba(255,255,255,0.5)')
            .attr('font-size', '9px')
            .text(d => d.value + '次');

        // 无向连线（对称）
        svg.append('g')
            .selectAll('path')
            .data(chord)
            .join('path')
            .attr('class', 'ribbon-path')
            .attr('d', ribbon)
            .attr('fill', d => color(d.source.index))
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.5)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 0.9).attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 1.5);
                showChordTooltip(event, {
                    source: labels[d.source.index],
                    target: labels[d.target.index],
                    fromTo: undirectedMatrix[d.source.index][d.target.index],
                    toFrom: undirectedMatrix[d.target.index][d.source.index],
                    isUndirected: true
                });
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', 0.5).attr('stroke', 'rgba(255,255,255,0.1)').attr('stroke-width', 0.5);
                hideChordTooltip();
            });

        container._d3Svg = svg;
    }

    // ========== ECharts 网络图（粗细差距更明显） ==========
    function drawNetworkDiagram(data) {
        const container = document.getElementById('connectionChart');
        if (!container || !data) return;
        container.innerHTML = '';

        if (connectionChartInstance) {
            connectionChartInstance.dispose();
            connectionChartInstance = null;
        }

        const div = document.createElement('div');
        div.style.width = '100%';
        div.style.height = '420px';
        container.appendChild(div);

        connectionChartInstance = echarts.init(div, 'dark');

        const { nodes, links } = data;

        // 计算最大值用于缩放
        const maxValue = Math.max(...links.map(l => l.value), 1);
        const minValue = Math.min(...links.map(l => l.value), 1);

        const option = {
            tooltip: {
                formatter: function (params) {
                    if (params.dataType === 'edge') {
                        return `<b>${params.data.source}</b> ↔ <b>${params.data.target}</b><br/>
                总流量: ${params.data.value} 次<br/>
                ${params.data.fromValue ? '→ ' + params.data.fromValue + ' 次' : ''}
                ${params.data.toValue ? '← ' + params.data.toValue + ' 次' : ''}`;
                    }
                    return `<b>${params.name}</b><br/>总流量: ${params.value} 次`;
                }
            },
            series: [{
                type: 'graph',
                layout: 'force',
                force: {
                    repulsion: 350,
                    gravity: 0.08,
                    edgeLength: [80, 250],
                    layoutAnimation: true,
                    friction: 0.6
                },
                data: nodes.map(n => ({
                    ...n,
                    symbolSize: Math.max(18, Math.min(60, Math.sqrt(n.value) * 8)),
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{b}',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: '500'
                    },
                    emphasis: {
                        label: { fontSize: 16, fontWeight: 'bold' },
                        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(255,255,255,0.3)' }
                    }
                })),
                edges: links.map(link => {
                    // 用平方根放大差距
                    const scaledWidth = Math.max(1, Math.pow(link.value / maxValue, 1.5) * 12);
                    const scaledOpacity = 0.2 + (link.value / maxValue) * 0.6;

                    return {
                        source: link.source,
                        target: link.target,
                        value: link.value,
                        fromValue: link.fromValue,
                        toValue: link.toValue,
                        lineStyle: {
                            width: scaledWidth,
                            opacity: scaledOpacity,
                            curveness: 0.1,
                            color: `rgba(255,255,255,${scaledOpacity})`
                        },
                        emphasis: {
                            lineStyle: {
                                width: scaledWidth + 4,
                                opacity: 1,
                                shadowBlur: 8,
                                shadowColor: 'rgba(255,255,255,0.5)'
                            }
                        }
                    };
                }),
                roam: true,
                draggable: true,
                edgeSymbol: ['none', 'none'],
                emphasis: {
                    focus: 'adjacency'
                }
            }]
        };

        connectionChartInstance.setOption(option);

        window.addEventListener('resize', () => {
            if (connectionChartInstance) connectionChartInstance.resize();
        });
    }

    // ========== 修复 Tooltip ==========
    function showChordTooltip(event, data) {
        let tooltip = document.getElementById('chordTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'chordTooltip';
            tooltip.style.cssText = `
position: fixed;
background: rgba(0,0,0,0.92);
color: #fff;
padding: 10px 16px;
border-radius: 10px;
font-size: 0.8rem;
pointer-events: none;
z-index: 500;
border: 1px solid rgba(255,255,255,0.15);
line-height: 1.5;
        `;
            document.body.appendChild(tooltip);
        }

        if (data.isUndirected) {
            tooltip.innerHTML = `
<b>${data.source}</b> ↔ <b>${data.target}</b><br/>
<span style="color: rgba(255,255,255,0.5);">合计: ${data.fromTo} 次</span>
        `;
        } else {
            tooltip.innerHTML = `
<b>${data.source}</b> → <b>${data.target}</b>: ${data.fromTo} 次<br/>
<b>${data.target}</b> → <b>${data.source}</b>: ${data.toFrom} 次<br/>
<span style="color: rgba(255,255,255,0.5);">合计: ${(data.fromTo || 0) + (data.toFrom || 0)} 次</span>
        `;
        }

        tooltip.style.left = (event.clientX + 14) + 'px';
        tooltip.style.top = (event.clientY - 60) + 'px';
        tooltip.style.display = 'block';
    }

    function hideChordTooltip() {
        const tooltip = document.getElementById('chordTooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    // ========== 绘制关联图 ==========
    function drawConnectionChart() {
        const data = prepareConnectionData(currentCityCount);
        if (!data) return;

        // 清理
        const container = document.getElementById('connectionChart');
        container.innerHTML = '';
        if (connectionChartInstance) {
            connectionChartInstance.dispose();
            connectionChartInstance = null;
        }

        switch (currentConnectionType) {
            case 'chord-directed':
                drawDirectedChord(data);
                break;
            case 'chord-undirected':
                drawUndirectedChord(data);
                break;
            case 'network':
                drawNetworkDiagram(data);
                break;
        }

        document.getElementById('connectionInfo').textContent =
            `展示 ${data.nodes.length} 个城市，${data.links.length} 条关联`;
    }

    // ========== 事件绑定 ==========
    document.getElementById('toggleConnectionPanelBtn').addEventListener('click', () => {
        togglePanel('floatingConnectionPanel');
    });

    document.querySelectorAll('[data-connection-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-connection-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentConnectionType = btn.dataset.connectionType;
            drawConnectionChart();
        });
    });

    document.getElementById('cityCountSlider').addEventListener('input', (e) => {
        currentCityCount = parseInt(e.target.value);
        document.getElementById('cityCountValue').textContent = currentCityCount;
        drawConnectionChart();
    });

    makeDraggable(document.getElementById('floatingConnectionPanel'), document.getElementById('connectionPanelHeader'));

    // ========== 浮动面板控制 ==========
    function togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const isVisible = panel.classList.contains('visible');

        // 关闭其他面板
        document.querySelectorAll('.floating-chart-panel').forEach(p => p.classList.remove('visible'));

        const sidebarRight = document.getElementById('sidebarRight');
        const toggleRightBtn = document.getElementById('toggleRightBtn');
        if (!sidebarRight.classList.contains('collapsed')) {
            toggleRightBtn.click()
        }

        if (!isVisible) {
            panel.classList.add('visible');

            // 根据面板类型绘制图表
            if (panelId === 'floatingScatterPanel') drawFloatingScatter();
            else if (panelId === 'floatingHistPanel') drawFloatingHist();
            else if (panelId === 'floatingTimeDistPanel') drawFloatingTimeDist();
            else if (panelId === 'floatingConnectionPanel') drawConnectionChart();
        }
    }

    // 工具栏按钮
    document.getElementById('toggleScatterPanelBtn')?.addEventListener('click', () => togglePanel('floatingScatterPanel'));
    document.getElementById('toggleHistPanelBtn')?.addEventListener('click', () => togglePanel('floatingHistPanel'));
    document.getElementById('toggleTimeDistPanelBtn')?.addEventListener('click', () => togglePanel('floatingTimeDistPanel'));

    // 关闭和最小化按钮
    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.closest('.floating-chart-panel').classList.remove('visible');
        });
    });

    document.querySelectorAll('.minimize-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.closest('.floating-chart-panel').classList.remove('visible');
        });
    });

    // 散点图类型切换
    document.querySelectorAll('[data-scatter-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-scatter-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScatterType = btn.dataset.scatterType;
            drawFloatingScatter();
        });
    });

    // 直方图类型切换
    document.querySelectorAll('[data-hist-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-hist-type]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHistType = btn.dataset.histType;
            drawFloatingHist();
        });
    });

    

    // ========== 浮动面板拖拽 ==========
    function makeDraggable(panel, header) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        let rafId = null;

        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            // 如果点击的是按钮，不触发拖拽
            if (e.target.closest('button')) return;

            e.preventDefault();
            e.stopPropagation();

            // 如果已经在拖拽中，不重复触发
            if (isDragging) return;

            isDragging = true;

            const panelRect = panel.getBoundingClientRect();
            const parentRect = panel.offsetParent.getBoundingClientRect();
            startLeft = panelRect.left - parentRect.left;
            startTop = panelRect.top - parentRect.top;
            panel.style.left = `${startLeft}px`;
            panel.style.top = `${startTop}px`;
            panel.style.transform = 'none';

            // 记录初始值
            startX = e.clientX;
            startY = e.clientY;

            panel.style.transition = 'none';
            panel.style.cursor = 'grabbing';
            header.style.cursor = 'grabbing';

            // 添加全局遮罩
            const dragMask = document.getElementById('dragMask');
            if (dragMask) {
                dragMask.style.display = 'block';
                dragMask.style.cursor = 'grabbing';
            }
        });

        // 使用独立的全局事件处理函数
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();

            // 使用 requestAnimationFrame 优化性能
            if (rafId) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                // 计算移动距离
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // 计算新位置
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;

                // 边界限制
                const panelWidth = panel.offsetWidth;
                const panelHeight = panel.offsetHeight;

                newLeft = Math.max(0, Math.min(window.innerWidth - panelWidth, newLeft));
                newTop = Math.max(0, Math.min(window.innerHeight - panelHeight, newTop));

                panel.style.left = (newLeft + 'px');
                panel.style.top = (newTop + 'px');
                rafId = null;
            });
        };

        const handleMouseUp = (e) => {
            if (!isDragging) return;

            isDragging = false;
            panel.style.transition = '';
            panel.style.cursor = '';
            header.style.cursor = 'move';

            const dragMask = document.getElementById('dragMask');
            if (dragMask) {
                dragMask.style.display = 'none';
            }

            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        // 在 document 上添加事件监听（只添加一次）
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    makeDraggable(floatingScatterPanel, document.getElementById('scatterPanelHeader'));
    makeDraggable(floatingHistPanel, document.getElementById('histPanelHeader'));
    makeDraggable(floatingTimeDistPanel, document.getElementById('timeDistPanelHeader'));

    // ========== 初始化 ==========
    (async function init() {
        if (window.innerWidth < 820 && !sidebarLeft.classList.contains('collapsed')) {
            collapseLeftBtn.click();
        }
        if (window.innerWidth < 1180 && !sidebarRight.classList.contains('collapsed')) {
            toggleRightBtn.click();
        } else {
            syncRightTogglePosition();
        }
        window.addEventListener('resize', syncRightTogglePosition);

        await loadAllData();

        // 默认激活地图1
        switchMap('map1');
    })();

})();
