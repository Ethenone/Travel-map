(function () {
    'use strict';

    const panel = document.querySelector('.road-panel');
    if (!panel || typeof map === 'undefined') return;

    const control = document.createElement('label');
    control.className = 'track-mode-control';
    control.innerHTML = '<span>轨迹图层</span><select id="trackMode"><option value="road">仅公路</option><option value="combined">铁路 + 公路</option></select>';
    panel.insertBefore(control, panel.querySelector('.city-select'));

    const legend = document.createElement('div');
    legend.className = 'track-mode-legend';
    legend.innerHTML = '<span><i></i>公路</span><span class="rail-key" hidden><i></i>铁路</span>';
    panel.insertBefore(legend, panel.querySelector('.city-select'));

    const status = document.createElement('div');
    status.className = 'track-mode-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    panel.insertBefore(status, panel.querySelector('.city-select'));

    const selector = control.querySelector('select');
    const railKey = legend.querySelector('.rail-key');
    let railwayRequest;

    function showRailway(visible) {
        for (const id of ['rail-overlay-glow', 'rail-overlay-tracks']) {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
            }
        }
        railKey.hidden = !visible;
    }

    function loadRailway() {
        if (!railwayRequest) {
            railwayRequest = fetch('../data/rail_routes_real.geojson')
                .then(response => {
                    if (!response.ok) throw new Error('铁路轨迹加载失败');
                    return response.json();
                })
                .catch(error => {
                    railwayRequest = null;
                    throw error;
                });
        }
        return railwayRequest;
    }

    async function setMode() {
        const combined = selector.value === 'combined';
        if (!combined) {
            showRailway(false);
            status.hidden = true;
            return;
        }

        if (map.getLayer('rail-overlay-tracks')) {
            showRailway(true);
            status.hidden = true;
            return;
        }

        status.textContent = '正在加载铁路轨迹…';
        status.hidden = false;
        try {
            const routes = await loadRailway();
            if (selector.value !== 'combined') return;
            if (!map.getSource('road-journeys')) {
                await new Promise(resolve => map.once('style.load', resolve));
            }
            if (selector.value !== 'combined') return;
            if (!map.getSource('rail-overlay')) {
                map.addSource('rail-overlay', { type: 'geojson', data: routes });
                map.addLayer({
                    id: 'rail-overlay-glow', type: 'line', source: 'rail-overlay',
                    paint: { 'line-color': '#ffb35c', 'line-width': 2.5, 'line-opacity': .035, 'line-blur': 2 }
                }, 'road-glow');
                map.addLayer({
                    id: 'rail-overlay-tracks', type: 'line', source: 'rail-overlay',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#ffb35c', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, .55, 13, 1.7], 'line-opacity': .28 }
                }, 'road-glow');
                map.on('click', 'rail-overlay-tracks', event => {
                    const props = event.features[0].properties;
                    const popup = document.createElement('div');
                    popup.className = 'route-popup';
                    const title = document.createElement('strong');
                    title.textContent = String(props.train || '铁路轨迹');
                    popup.appendChild(title);
                    const details = document.createElement('span');
                    details.textContent = [props.from, props.to].filter(Boolean).join(' → ');
                    popup.appendChild(details);
                    new maplibregl.Popup({ closeButton: false, maxWidth: '280px' })
                        .setLngLat(event.lngLat).setDOMContent(popup).addTo(map);
                });
                map.on('mouseenter', 'rail-overlay-tracks', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'rail-overlay-tracks', () => { map.getCanvas().style.cursor = ''; });
            }
            showRailway(true);
            status.hidden = true;
        } catch (error) {
            if (selector.value === 'combined') {
                status.textContent = '铁路轨迹加载失败，请重试';
                status.hidden = false;
            }
        }
    }

    selector.addEventListener('change', setMode);
})();
