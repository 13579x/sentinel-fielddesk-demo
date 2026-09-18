(() => {
  "use strict";

  const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const DATA_URL = "../validation_reference_900_v1/points/interp_sheet_900_v3.csv";
  const STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
  const DATA_TILEJSON_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/tilejson.json";
  const DATA_POINT_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/point";
  const WAYBACK_SEARCH_URL = "https://www.arcgis.com/sharing/rest/search";
  const WORLD_IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const STORAGE_PREFIX = "sentinel-fielddesk:v2:";

  const CATEGORIES = [
    {
      label: "林地",
      shortcut: "1",
      color: "#4eb77e",
      description: "连续乔木冠层",
    },
    {
      label: "水田",
      shortcut: "2",
      color: "#52cad1",
      description: "有水稻种植信号",
    },
    {
      label: "旱地",
      shortcut: "3",
      color: "#e7b765",
      description: "旱作或园地",
    },
    {
      label: "建设用地",
      shortcut: "4",
      color: "#f0785d",
      description: "建筑与不透水面",
    },
    {
      label: "灌草地",
      shortcut: "5",
      color: "#a7bd68",
      description: "灌丛、草坡或撂荒",
    },
    {
      label: "水域",
      shortcut: "6",
      color: "#4b8fe0",
      description: "开放水面为主",
    },
    {
      label: "不确定",
      shortcut: "7",
      color: "#b2b9b5",
      description: "证据不足或混合像元",
    },
  ];

  const LABEL_ALIASES = new Map([
    ["稻作耕地", "水田"],
    ["Rice cropland", "水田"],
    ["rice cropland", "水田"],
    ["其他耕地", "旱地"],
    ["Other cropland", "旱地"],
    ["other cropland", "旱地"],
    ["Uncertain", "不确定"],
    ["uncertain", "不确定"],
  ]);

  const state = {
    rows: [],
    headers: [],
    activeIndex: 0,
    activeYear: 2025,
    filteredIndices: [],
    query: "",
    unlabeledOnly: false,
    fileName: "interp_sheet_900_v3.csv",
    storageKey: "",
    map: null,
    falseColorMap: null,
    highresMap: null,
    ndviMap: null,
    baseLayer: null,
    falseColorBaseLayer: null,
    highresBaseLayer: null,
    ndviBaseLayer: null,
    pointMarker: null,
    falseColorMarker: null,
    highresMarker: null,
    ndviMarker: null,
    overviewLayer: null,
    falseColorOverviewLayer: null,
    highresOverviewLayer: null,
    ndviOverviewLayer: null,
    sentinelLayer: null,
    falseColorLayer: null,
    highresHistoricalLayer: null,
    ndviLayer: null,
    markersVisible: true,
    allPointsVisible: true,
    syncingMaps: false,
    sceneCache: new Map(),
    waybackCache: new Map(),
    requestToken: 0,
    toastTimer: null,
    saveTimer: null,
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    renderCategoryButtons();
    renderYearStrip();
    renderHistoryYears();
    bindEvents();
    initializeMap();
    renderEmptyState();
    await loadDefaultData();
  }

  function cacheDom() {
    const ids = [
      "saveStatus",
      "saveStatusText",
      "loadCsvButton",
      "csvFileInput",
      "exportButton",
      "batchBadge",
      "datasetFileName",
      "totalCount",
      "currentYearCount",
      "currentYearMetricLabel",
      "allYearCount",
      "yearProgressFill",
      "progressCaption",
      "progressPercent",
      "pointSearch",
      "unlabeledOnly",
      "queueResultCount",
      "nextUnlabeledButton",
      "queueList",
      "activePointId",
      "activePointCoord",
      "sceneStatus",
      "sceneStatusText",
      "toggleMarkerButton",
      "toggleAllPointsButton",
      "recenterButton",
      "yearStrip",
      "mapSentinel",
      "mapFalseColor",
      "mapHighres",
      "mapNdvi",
      "auxStatus",
      "auxNdvi",
      "auxNdwi",
      "auxNdbi",
      "auxNdmi",
      "auxBiasCard",
      "auxBias",
      "auxHint",
      "auxB03",
      "auxB04",
      "auxB08",
      "auxB11",
      "mapCoordinates",
      "mapSource",
      "mapSyncStatus",
      "mapZoomHint",
      "highresLayerStatus",
      "mapLoading",
      "scenePreviewPlaceholder",
      "scenePreview",
      "sceneDate",
      "sceneSubline",
      "sceneCloudTag",
      "sceneTileTag",
      "historyYears",
      "yearStamp",
      "contextPointId",
      "contextYear",
      "selectedLabel",
      "categoryGrid",
      "uncertainReason",
      "pointNote",
      "saveNextButton",
      "previousButton",
      "nextButton",
      "clearLocalButton",
      "toast",
    ];

    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
    els.mapYearBadges = [...document.querySelectorAll("[data-map-year]")];
  }

  function bindEvents() {
    els.loadCsvButton.addEventListener("click", () => els.csvFileInput.click());
    els.csvFileInput.addEventListener("change", handleFileSelection);
    els.exportButton.addEventListener("click", exportCsv);
    els.pointSearch.addEventListener("input", () => {
      state.query = els.pointSearch.value.trim().toLowerCase();
      renderQueue();
    });
    els.unlabeledOnly.addEventListener("change", () => {
      state.unlabeledOnly = els.unlabeledOnly.checked;
      renderQueue();
    });
    els.nextUnlabeledButton.addEventListener("click", () => goRelative(1, true));
    els.queueList.addEventListener("click", (event) => {
      const rowButton = event.target.closest(".queue-row");
      if (!rowButton) return;
      selectPoint(Number(rowButton.dataset.index));
    });
    els.yearStrip.addEventListener("click", handleYearClick);
    els.historyYears.addEventListener("click", handleYearClick);
    els.categoryGrid.addEventListener("click", (event) => {
      const button = event.target.closest(".category-button");
      if (!button) return;
      setCurrentLabel(button.dataset.label);
    });
    document.querySelectorAll(".flag-checkbox input[data-flag]").forEach((input) => {
      input.addEventListener("change", () => {
        const row = getActiveRow();
        if (!row) return;
        row[input.dataset.flag] = input.checked ? "1" : "";
        queuePersist();
        setSaveStatus("已保存本机缓存", "saved");
      });
    });
    els.uncertainReason.addEventListener("input", queuePersist);
    els.pointNote.addEventListener("input", queuePersist);
    els.saveNextButton.addEventListener("click", () => {
      saveLocal();
      goRelative(1, state.unlabeledOnly);
    });
    els.previousButton.addEventListener("click", () => goRelative(-1, false));
    els.nextButton.addEventListener("click", () => goRelative(1, state.unlabeledOnly));
    els.toggleMarkerButton.addEventListener("click", () => setMarkersVisible(!state.markersVisible));
    els.toggleAllPointsButton.addEventListener("click", () => setAllPointsVisible(!state.allPointsVisible));
    els.recenterButton.addEventListener("click", recenterMap);
    els.clearLocalButton.addEventListener("click", clearLocalAnnotations);
    document.addEventListener("keydown", handleKeyboardShortcut);
  }

  function initializeMap() {
    if (!window.L || !els.mapSentinel || !els.mapFalseColor || !els.mapHighres || !els.mapNdvi) {
      setSceneStatus("地图组件未加载", "error");
      return;
    }

    const mapOptions = {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
    };

    state.map = window.L.map(els.mapSentinel, mapOptions).setView([29.56, 106.55], 7);
    state.falseColorMap = window.L.map(els.mapFalseColor, mapOptions).setView([29.56, 106.55], 7);
    state.highresMap = window.L.map(els.mapHighres, mapOptions).setView([29.56, 106.55], 7);
    state.ndviMap = window.L.map(els.mapNdvi, mapOptions).setView([29.56, 106.55], 7);

    getSynchronizedMaps().forEach((map) => window.L.control.zoom({ position: "bottomright" }).addTo(map));
    const referenceLayerOptions = {
      maxZoom: 23,
      opacity: 0.94,
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    };
    state.baseLayer = window.L.tileLayer(WORLD_IMAGERY_URL, referenceLayerOptions).addTo(state.map);
    state.falseColorBaseLayer = window.L.tileLayer(WORLD_IMAGERY_URL, referenceLayerOptions).addTo(state.falseColorMap);
    state.highresBaseLayer = window.L.tileLayer(WORLD_IMAGERY_URL, referenceLayerOptions).addTo(state.highresMap);
    state.ndviBaseLayer = window.L.tileLayer(WORLD_IMAGERY_URL, referenceLayerOptions).addTo(state.ndviMap);
    attachSynchronizedMaps();
    window.addEventListener("resize", refreshMapSizes, { passive: true });
    window.addEventListener("orientationchange", refreshMapSizes, { passive: true });
  }

  function refreshMapSizes() {
    window.requestAnimationFrame(() => {
      getSynchronizedMaps().forEach((map) => map.invalidateSize({ pan: false, animate: false }));
    });
  }

  function getSynchronizedMaps() {
    return [state.map, state.falseColorMap, state.highresMap, state.ndviMap].filter(Boolean);
  }

  function getMapEntries() {
    return [
      { map: state.map, markerKey: "pointMarker" },
      { map: state.falseColorMap, markerKey: "falseColorMarker" },
      { map: state.highresMap, markerKey: "highresMarker" },
      { map: state.ndviMap, markerKey: "ndviMarker" },
    ].filter((entry) => entry.map);
  }

  function getOverviewLayerEntries() {
    return [
      { map: state.map, layerKey: "overviewLayer" },
      { map: state.falseColorMap, layerKey: "falseColorOverviewLayer" },
      { map: state.highresMap, layerKey: "highresOverviewLayer" },
      { map: state.ndviMap, layerKey: "ndviOverviewLayer" },
    ].filter((entry) => entry.map);
  }

  function clearOverviewLayers() {
    getOverviewLayerEntries().forEach(({ map, layerKey }) => {
      const layer = state[layerKey];
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      state[layerKey] = null;
    });
  }

  function renderOverviewPoints() {
    clearOverviewLayers();
    if (!state.rows.length) {
      setAllPointsVisibleControl();
      return;
    }
    getOverviewLayerEntries().forEach(({ map, layerKey }) => {
      const layer = window.L.layerGroup();
      state.rows.forEach((row) => {
        const lon = Number(row.lon);
        const lat = Number(row.lat);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        window.L.circleMarker([lat, lon], {
          radius: 3,
          color: "#d8f3ea",
          weight: 1,
          opacity: 0.58,
          fillColor: "#61c9aa",
          fillOpacity: 0.2,
          interactive: false,
          className: "point-overview-dot",
        }).addTo(layer);
      });
      state[layerKey] = layer;
      if (state.allPointsVisible) layer.addTo(map);
    });
    setAllPointsVisibleControl();
  }

  function setAllPointsVisible(isVisible) {
    state.allPointsVisible = Boolean(isVisible);
    getOverviewLayerEntries().forEach(({ map, layerKey }) => {
      const layer = state[layerKey];
      if (!layer) return;
      if (state.allPointsVisible) {
        layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    setAllPointsVisibleControl();
  }

  function setAllPointsVisibleControl() {
    if (!els.toggleAllPointsButton) return;
    els.toggleAllPointsButton.classList.toggle("is-off", !state.allPointsVisible);
    els.toggleAllPointsButton.setAttribute("aria-pressed", String(state.allPointsVisible));
    els.toggleAllPointsButton.title = state.allPointsVisible ? "隐藏全部点位" : "显示全部点位";
  }

  function attachSynchronizedMaps() {
    getSynchronizedMaps().forEach((sourceMap) => {
      sourceMap.on("move", () => syncMapView(sourceMap));
    });
  }

  function syncMapView(sourceMap) {
    if (state.syncingMaps) return;
    state.syncingMaps = true;
    const center = sourceMap.getCenter();
    const zoom = sourceMap.getZoom();
    getSynchronizedMaps().filter((targetMap) => targetMap !== sourceMap).forEach((targetMap) => {
      targetMap.setView(center, zoom, { animate: false });
    });
    window.requestAnimationFrame(() => {
      state.syncingMaps = false;
    });
  }

  async function loadDefaultData() {
    setSaveStatus("正在载入样本…", "loading");
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`CSV 请求失败（${response.status}）`);
      const text = await response.text();
      applyParsedData(parseCsv(text), "interp_sheet_900_v3.csv");
      showToast("900 个参考点已载入，可以开始判读");
    } catch (error) {
      console.error(error);
      setSaveStatus("CSV 未载入", "error");
      els.queueList.innerHTML = `
        <div class="empty-state">
          <strong>无法自动读取判读表</strong>
          <span>请点击右上角“载入 CSV”，或使用本目录的本地 HTTP 服务打开。</span>
        </div>`;
      showToast("自动载入失败，请手动选择 interp_sheet_900_v3.csv");
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.includes("point_id") || !parsed.headers.includes("lon") || !parsed.headers.includes("lat")) {
        throw new Error("CSV 缺少 point_id / lon / lat 字段");
      }
      applyParsedData(parsed, file.name);
      showToast(`${parsed.rows.length} 个点位已载入：${file.name}`);
    } catch (error) {
      console.error(error);
      setSaveStatus("CSV 格式错误", "error");
      showToast(`载入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function applyParsedData(parsed, fileName) {
    state.headers = parsed.headers;
    state.rows = parsed.rows;
    state.fileName = fileName || "interp_sheet_900_v3.csv";
    state.storageKey = getStorageKey(state.fileName, state.headers);
    state.activeIndex = 0;
    state.activeYear = 2025;
    state.sceneCache.clear();
    state.waybackCache.clear();
    clearSceneLayers();
    restoreLocalEdits();
    renderAll();
    renderOverviewPoints();
    selectPoint(0, { loadScene: true });
    setSaveStatus(hasStoredEdits() ? "已恢复本机缓存" : "已载入样本", hasStoredEdits() ? "saved" : "ready");
  }

  function parseCsv(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const records = [];
    let record = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        record.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") index += 1;
        record.push(field);
        if (record.some((value) => value !== "")) records.push(record);
        record = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field !== "" || record.length > 0) {
      record.push(field);
      if (record.some((value) => value !== "")) records.push(record);
    }

    if (records.length === 0) throw new Error("CSV 没有可用记录");
    const headers = records.shift().map((header) => header.trim());
    const rows = records.map((values) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = String(values[index] ?? "").trim();
      });
      return row;
    });
    return { headers, rows };
  }

  function serializeCsv() {
    const escapeField = (value) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const exportHeaders = state.headers.filter((header) => !/^conf_\d{4}$/.test(header));
    const lines = [exportHeaders.map(escapeField).join(",")];
    state.rows.forEach((row) => {
      lines.push(exportHeaders.map((header) => escapeField(row[header])).join(","));
    });
    return `\uFEFF${lines.join("\r\n")}\r\n`;
  }

  function exportCsv() {
    if (!state.rows.length) {
      showToast("还没有可导出的判读表");
      return;
    }
    saveLocal();
    const blob = new Blob([serializeCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    anchor.href = url;
    anchor.download = `${state.fileName.replace(/\.csv$/i, "")}_annotated_${date}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("判读表已导出，原始 CSV 保持不变");
  }

  function renderAll() {
    renderDatasetStats();
    renderQueue();
    renderYearStrip();
    renderHistoryYears();
    renderInspector();
    renderCurrentPoint();
  }

  function renderEmptyState() {
    renderDatasetStats();
    els.queueList.innerHTML = `
      <div class="empty-state">
        <strong>正在读取参考样本</strong>
        <span>点位队列和年度影像会在数据载入后出现。</span>
      </div>`;
  }

  function renderDatasetStats() {
    const total = state.rows.length;
    const labeledThisYear = state.rows.filter((row) => Boolean(getCanonicalLabel(row[getLabelField(state.activeYear)]))).length;
    const labeledAll = state.rows.reduce((count, row) => {
      return count + YEARS.filter((year) => Boolean(getCanonicalLabel(row[getLabelField(year)]))).length;
    }, 0);
    const percent = total ? Math.round((labeledThisYear / total) * 100) : 0;

    els.batchBadge.textContent = total || "—";
    els.totalCount.textContent = total || "—";
    els.currentYearCount.textContent = total ? `${labeledThisYear}` : "—";
    els.currentYearMetricLabel.textContent = `${state.activeYear} 已判`;
    els.allYearCount.textContent = total ? `${labeledAll}` : "—";
    els.yearProgressFill.style.width = `${percent}%`;
    els.progressCaption.textContent = total ? `${state.activeYear} 年度完成` : "尚未载入数据";
    els.progressPercent.textContent = `${percent}%`;
    els.datasetFileName.textContent = state.fileName;
  }

  function renderQueue() {
    if (!state.rows.length) return;
    const query = state.query;
    const indices = state.rows.reduce((matches, row, index) => {
      const id = String(row.point_id || "").toLowerCase();
      const matchesQuery = !query || id.includes(query);
      const matchesUnlabeled = !state.unlabeledOnly || !getCanonicalLabel(row[getLabelField(state.activeYear)]);
      if (matchesQuery && matchesUnlabeled) matches.push(index);
      return matches;
    }, []);
    state.filteredIndices = indices;
    els.queueResultCount.textContent = `${indices.length} 个点位`;

    if (indices.length === 0) {
      els.queueList.innerHTML = `
        <div class="empty-state">
          <strong>没有匹配点位</strong>
          <span>可以清空搜索或切换筛选条件。</span>
        </div>`;
      return;
    }

    const visible = indices;
    const rowsHtml = visible.map((index) => {
      const row = state.rows[index];
      const label = getCanonicalLabel(row[getLabelField(state.activeYear)]);
      const activeClass = index === state.activeIndex ? " is-active" : "";
      const doneClass = label ? " is-done" : "";
      return `
        <button class="queue-row${activeClass}${doneClass}" data-index="${index}" type="button" role="option" aria-selected="${index === state.activeIndex}">
          <i class="queue-dot" aria-hidden="true"></i>
          <span class="queue-id">${escapeHtml(row.point_id || `ROW${index + 1}`)}</span>
          <span class="queue-label">${escapeHtml(label || "待判")}</span>
        </button>`;
    }).join("");
    els.queueList.innerHTML = rowsHtml;
  }

  function renderYearStrip() {
    if (!els.yearStrip) return;
    els.yearStrip.innerHTML = YEARS.map((year) => {
      const label = getActiveRow()?.[getLabelField(year)];
      const isDone = Boolean(getCanonicalLabel(label));
      const activeClass = year === state.activeYear ? " is-active" : "";
      const doneClass = isDone ? " is-done" : "";
      return `
        <button class="year-tab${activeClass}${doneClass}" data-year="${year}" type="button" role="tab" aria-selected="${year === state.activeYear}">
          <span class="year-tab-year">${year}</span>
          <span class="year-tab-status">${isDone ? "已判" : "待判"}</span>
        </button>`;
    }).join("");
  }

  function renderHistoryYears() {
    if (!els.historyYears) return;
    els.historyYears.innerHTML = YEARS.map((year) => {
      const label = getActiveRow()?.[getLabelField(year)];
      const activeClass = year === state.activeYear ? " is-active" : "";
      const doneClass = getCanonicalLabel(label) ? " is-labeled" : "";
      return `<button class="history-year${activeClass}${doneClass}" data-year="${year}" type="button">${year}</button>`;
    }).join("");
  }

  function renderInspector() {
    const row = getActiveRow();
    const label = row ? getCanonicalLabel(row[getLabelField(state.activeYear)]) : "";

    els.yearStamp.textContent = state.activeYear;
    els.contextPointId.textContent = row?.point_id || "—";
    els.contextYear.textContent = state.activeYear;
    els.selectedLabel.textContent = label || "尚未选择";
    els.selectedLabel.classList.toggle("has-value", Boolean(label));

    els.categoryGrid.querySelectorAll(".category-button").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.label === label);
      button.setAttribute("aria-pressed", String(button.dataset.label === label));
    });

    document.querySelectorAll(".flag-checkbox input[data-flag]").forEach((input) => {
      input.checked = Boolean(row && isFlagSet(row[input.dataset.flag]));
    });
    els.uncertainReason.value = row?.uncertain_reason || "";
    els.pointNote.value = row?.note || "";
  }

  function renderCategoryButtons() {
    els.categoryGrid.innerHTML = CATEGORIES.map((category) => `
      <button class="category-button" data-label="${category.label}" type="button" aria-pressed="false" style="--category-color: ${category.color}">
        <span class="category-shortcut">${category.shortcut}</span>
        <span class="category-name">${category.label}</span>
        <span class="category-description">${category.description}</span>
      </button>`).join("");
  }

  function renderCurrentPoint() {
    const row = getActiveRow();
    const pointId = row?.point_id || "—";
    const lon = row ? Number(row.lon) : NaN;
    const lat = row ? Number(row.lat) : NaN;
    const coord = Number.isFinite(lon) && Number.isFinite(lat) ? `${lat.toFixed(5)}° N · ${lon.toFixed(5)}° E` : "坐标不可用";
    const compactCoord = Number.isFinite(lon) && Number.isFinite(lat) ? `${lon.toFixed(5)}, ${lat.toFixed(5)}` : "—";
    els.activePointId.textContent = pointId;
    els.activePointCoord.textContent = compactCoord;
    els.mapCoordinates.textContent = coord;
    updateMapPoint();
  }

  function renderMapYearBadges() {
    if (!els.mapYearBadges) return;
    els.mapYearBadges.forEach((badge) => {
      badge.textContent = state.activeYear;
    });
  }

  function selectPoint(index, options = {}) {
    if (!state.rows.length) return;
    const nextIndex = Math.max(0, Math.min(state.rows.length - 1, Number(index) || 0));
    state.activeIndex = nextIndex;
    renderDatasetStats();
    renderQueue();
    renderYearStrip();
    renderHistoryYears();
    renderInspector();
    renderCurrentPoint();
    if (options.loadScene !== false) loadSceneForCurrent();
  }

  function handleYearClick(event) {
    const button = event.target.closest("[data-year]");
    if (!button) return;
    setActiveYear(Number(button.dataset.year));
  }

  function setActiveYear(year) {
    if (!YEARS.includes(year)) return;
    state.activeYear = year;
    renderDatasetStats();
    renderQueue();
    renderYearStrip();
    renderHistoryYears();
    renderInspector();
    renderMapYearBadges();
    loadSceneForCurrent();
  }

  function setCurrentLabel(label) {
    const row = getActiveRow();
    if (!row || !CATEGORIES.some((category) => category.label === label)) return;
    row[getLabelField(state.activeYear)] = label;
    queuePersist();
    renderDatasetStats();
    renderQueue();
    renderYearStrip();
    renderHistoryYears();
    renderInspector();
    showToast(`${state.activeYear} 年 · ${label} 已记录`);
  }

  function goRelative(direction, unlabeledOnly = false) {
    if (!state.rows.length) return;
    const query = state.query;
    const total = state.rows.length;
    for (let offset = 1; offset <= total; offset += 1) {
      const candidate = (state.activeIndex + direction * offset + total) % total;
      const row = state.rows[candidate];
      const matchesQuery = !query || String(row.point_id || "").toLowerCase().includes(query);
      const matchesLabel = !unlabeledOnly || !getCanonicalLabel(row[getLabelField(state.activeYear)]);
      if (matchesQuery && matchesLabel) {
        selectPoint(candidate);
        return;
      }
    }
    showToast(unlabeledOnly ? "当前筛选范围内没有更多未判点位" : "已经回到当前队列起点");
  }

  function handleKeyboardShortcut(event) {
    const tagName = event.target?.tagName?.toLowerCase();
    const isTyping = tagName === "input" || tagName === "textarea" || tagName === "select" || event.target?.isContentEditable;
    if (isTyping) {
      if (event.key === "/" && event.target !== els.pointSearch) {
        event.preventDefault();
        els.pointSearch.focus();
      }
      return;
    }

    if (/^[1-7]$/.test(event.key)) {
      setCurrentLabel(CATEGORIES[Number(event.key) - 1].label);
      return;
    }
    if (event.key.toLowerCase() === "u") {
      setCurrentLabel("不确定");
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveYear(YEARS[Math.max(0, YEARS.indexOf(state.activeYear) - 1)]);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveYear(YEARS[Math.min(YEARS.length - 1, YEARS.indexOf(state.activeYear) + 1)]);
      return;
    }
    if (event.key.toLowerCase() === "n") {
      goRelative(1, state.unlabeledOnly);
      return;
    }
    if (event.key.toLowerCase() === "p") {
      goRelative(-1, false);
      return;
    }
    if (event.key.toLowerCase() === "m") {
      setMarkersVisible(!state.markersVisible);
      return;
    }
    if (event.key.toLowerCase() === "s") {
      saveLocal();
      showToast("当前判读已保存到本机缓存");
    }
  }

  function updateMapPoint() {
    const row = getActiveRow();
    const lon = row ? Number(row.lon) : NaN;
    const lat = row ? Number(row.lat) : NaN;
    if (!getSynchronizedMaps().length || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const latLng = [lat, lon];
    const markerIcon = window.L.divIcon({
      className: "point-marker-icon",
      html: '<div class="point-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    getMapEntries().forEach(({ map, markerKey }) => {
      if (!state[markerKey]) {
        state[markerKey] = window.L.marker(latLng, {
          icon: markerIcon,
          opacity: state.markersVisible ? 1 : 0,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        state[markerKey].setLatLng(latLng);
      }
      state[markerKey].setOpacity(state.markersVisible ? 1 : 0);
      map.setView(latLng, Math.max(map.getZoom(), 12), { animate: false });
    });
    renderMapYearBadges();
    window.setTimeout(() => {
      getSynchronizedMaps().forEach((map) => map.invalidateSize());
    }, 30);
  }

  function setMarkersVisible(isVisible) {
    state.markersVisible = Boolean(isVisible);
    getMapEntries().forEach(({ markerKey }) => {
      state[markerKey]?.setOpacity(state.markersVisible ? 1 : 0);
    });
    if (els.toggleMarkerButton) {
      els.toggleMarkerButton.classList.toggle("is-off", !state.markersVisible);
      els.toggleMarkerButton.setAttribute("aria-pressed", String(state.markersVisible));
      els.toggleMarkerButton.title = state.markersVisible ? "隐藏点位准星" : "显示点位准星";
    }
  }

  function recenterMap() {
    const row = getActiveRow();
    const lon = row ? Number(row.lon) : NaN;
    const lat = row ? Number(row.lat) : NaN;
    if (!getSynchronizedMaps().length || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const latLng = [lat, lon];
    const zoom = Math.max(state.map.getZoom(), 14);
    getSynchronizedMaps().forEach((map) => map.setView(latLng, zoom, { animate: true }));
  }

  async function loadSceneForCurrent() {
    const row = getActiveRow();
    if (!row) return;
    const lon = Number(row.lon);
    const lat = Number(row.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      setSceneStatus("当前点坐标不可用", "error");
      return;
    }

    const year = state.activeYear;
    const cacheKey = `${row.point_id || state.activeIndex}:${year}`;
    const token = ++state.requestToken;
    clearSceneLayers();
    setSceneLoading(true);
    setSceneMeta(null);
    setAuxiliaryParameters(null, "loading");

    try {
      const scene = state.sceneCache.get(cacheKey) || await queryBestScene(lon, lat, year);
      if (token !== state.requestToken) return;
      state.sceneCache.set(cacheKey, scene);
      applyScene(scene, lat, lon);
    } catch (error) {
      if (token !== state.requestToken) return;
      setSceneLoading(false);
      setSceneStatus("影像检索失败", "error");
      els.sceneDate.textContent = "当前年份暂无可用场景";
      els.sceneSubline.textContent = "点位与标注功能仍可继续使用；可稍后重试。";
      els.sceneCloudTag.textContent = "云量 —";
      els.sceneTileTag.textContent = "STAC 请求失败";
      setAuxiliaryParameters(null, "error");
      showToast("Sentinel-2 影像暂时未加载，标注功能不受影响");
    }
  }

  async function queryBestScene(lon, lat, year) {
    const basePayload = {
      collections: ["sentinel-2-l2a"],
      intersects: { type: "Point", coordinates: [lon, lat] },
      datetime: `${year}-05-01T00:00:00Z/${year}-10-31T23:59:59Z`,
      limit: 30,
      query: { "eo:cloud_cover": { lt: 40 } },
    };
    let result = await postJson(STAC_SEARCH_URL, basePayload);
    let features = Array.isArray(result.features) ? result.features : [];

    if (features.length === 0) {
      result = await postJson(STAC_SEARCH_URL, {
        ...basePayload,
        datetime: `${year}-01-01T00:00:00Z/${year}-12-31T23:59:59Z`,
        query: { "eo:cloud_cover": { lt: 75 } },
      });
      features = Array.isArray(result.features) ? result.features : [];
    }

    if (features.length === 0) throw new Error(`No Sentinel scene for ${year}`);
    features.sort(compareScenes);
    const item = features[0];
    const tileJsonHref = item.assets?.tilejson?.href;
    const falseColorTileJsonUrl = buildItemTileJsonUrl(item.id, {
      assets: ["B08", "B04", "B03"],
      rescale: "0,3000",
    });
    const ndviTileJsonUrl = buildItemTileJsonUrl(item.id, {
      assets: ["B08", "B04"],
      expression: "(B08_b1-B04_b1)/(B08_b1+B04_b1)",
      rescale: "0,1",
      colormapName: "rdylgn",
    });
    const pointValuesUrl = buildItemPointUrl(item.id, lon, lat, ["B03", "B04", "B08", "B11"]);
    const [tileJson, falseColorTileJson, ndviTileJson, wayback, pointValues] = await Promise.all([
      getOptionalJson(tileJsonHref),
      getOptionalJson(falseColorTileJsonUrl),
      getOptionalJson(ndviTileJsonUrl),
      queryWaybackLayer(year, getSceneDate(item)).catch(() => null),
      getOptionalJson(pointValuesUrl),
    ]);

    return {
      item,
      tileJson,
      falseColorTileJson,
      ndviTileJson,
      wayback,
      pointValues,
      previewHref: item.assets?.rendered_preview?.href || null,
    };
  }

  function buildItemTileJsonUrl(itemId, { assets = [], expression = "", rescale = "", colormapName = "" } = {}) {
    const url = new URL(DATA_TILEJSON_URL);
    url.searchParams.set("collection", "sentinel-2-l2a");
    url.searchParams.set("item", itemId);
    url.searchParams.set("nodata", "0");
    url.searchParams.set("format", "png");
    assets.forEach((asset) => url.searchParams.append("assets", asset));
    if (expression) url.searchParams.set("expression", expression);
    if (rescale) url.searchParams.set("rescale", rescale);
    if (colormapName) url.searchParams.set("colormap_name", colormapName);
    return url.toString();
  }

  function buildItemPointUrl(itemId, lon, lat, assets = []) {
    const url = new URL(`${DATA_POINT_URL}/${lon},${lat}`);
    url.searchParams.set("collection", "sentinel-2-l2a");
    url.searchParams.set("item", itemId);
    url.searchParams.set("nodata", "0");
    assets.forEach((asset) => url.searchParams.append("assets", asset));
    return url.toString();
  }

  async function getOptionalJson(url) {
    if (!url) return null;
    try {
      return await getJson(url);
    } catch (error) {
      console.warn("Optional imagery layer unavailable", error);
      return null;
    }
  }

  async function queryWaybackLayer(year, targetDate = null) {
    const cachedCandidates = state.waybackCache.get(year);
    if (cachedCandidates) return selectWaybackCandidate(cachedCandidates, targetDate);
    const url = new URL(WAYBACK_SEARCH_URL);
    url.searchParams.set("f", "json");
    url.searchParams.set("num", "100");
    url.searchParams.set("start", "1");
    url.searchParams.set("q", `World Imagery Wayback ${year}`);
    const result = await getJson(url.toString());
    const candidates = (Array.isArray(result.results) ? result.results : [])
      .filter((candidate) => candidate.type === "WMTS")
      .map((candidate) => {
        const match = String(candidate.title || "").match(/^World Imagery \(Wayback (\d{4}-\d{2}-\d{2})\)$/);
        const template = String(candidate.url || "")
          .replace(/%7Blevel%7D/gi, "{level}")
          .replace(/%7Brow%7D/gi, "{row}")
          .replace(/%7Bcol%7D/gi, "{col}");
        if (!match || Number(match[1].slice(0, 4)) !== Number(year) || !template.includes("/tile/")) return null;
        return {
          date: match[1],
          title: candidate.title,
          itemId: candidate.id,
          tileUrl: template
            .replaceAll("{level}", "{z}")
            .replaceAll("{row}", "{y}")
            .replaceAll("{col}", "{x}"),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.date.localeCompare(right.date));
    state.waybackCache.set(year, candidates);
    return selectWaybackCandidate(candidates, targetDate);
  }

  function selectWaybackCandidate(candidates, targetDate = null) {
    if (!candidates.length) return null;
    if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) return candidates.at(-1) || null;
    return candidates
      .map((candidate) => ({
        candidate,
        distance: Math.abs(Date.parse(`${candidate.date}T00:00:00Z`) - targetDate.getTime()),
      }))
      .sort((left, right) => left.distance - right.distance || left.candidate.date.localeCompare(right.candidate.date))
      .at(0)?.candidate || null;
  }

  function compareScenes(left, right) {
    const leftCloud = getCloudCover(left);
    const rightCloud = getCloudCover(right);
    const leftDate = getSceneDate(left);
    const rightDate = getSceneDate(right);
    const targetMonth = 7;
    const leftMonthDistance = Math.abs((leftDate?.getUTCMonth() ?? targetMonth) + 1 - targetMonth);
    const rightMonthDistance = Math.abs((rightDate?.getUTCMonth() ?? targetMonth) + 1 - targetMonth);
    return (leftCloud - rightCloud) * 0.8 + (leftMonthDistance - rightMonthDistance) * 1.2;
  }

  async function postJson(url, payload) {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`STAC search failed (${response.status})`);
    return response.json();
  }

  async function getJson(url) {
    const response = await fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) throw new Error(`TileJSON failed (${response.status})`);
    return response.json();
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function applyScene(scene, lat, lon) {
    const tileUrl = scene.tileJson?.tiles?.[0] || "";
    state.sentinelLayer = addTileJsonLayer(scene.tileJson, state.map, "Sentinel-2 RGB · Microsoft Planetary Computer");
    state.falseColorLayer = addTileJsonLayer(scene.falseColorTileJson, state.falseColorMap, "Sentinel-2 NIR-R-G · Microsoft Planetary Computer");
    state.ndviLayer = addTileJsonLayer(scene.ndviTileJson, state.ndviMap, "Sentinel-2 NDVI · Microsoft Planetary Computer");
    if (scene.wayback?.tileUrl && state.highresMap) {
      state.highresHistoricalLayer = window.L.tileLayer(scene.wayback.tileUrl, {
        maxZoom: 23,
        minZoom: 0,
        opacity: 1,
        noWrap: true,
        attribution: `Esri World Imagery Wayback ${scene.wayback.date}`,
      }).addTo(state.highresMap);
    }
    if (state.map) state.map.setView([lat, lon], Math.max(state.map.getZoom(), 13), { animate: false });

    setSceneLoading(false);
    setSceneStatus("影像已就绪", "ready");
    setSceneMeta(scene);
    if (scene.previewHref) {
      els.scenePreview.src = scene.previewHref;
      els.scenePreview.hidden = false;
      els.scenePreviewPlaceholder.hidden = true;
      els.scenePreview.onerror = () => {
        els.scenePreview.hidden = true;
        els.scenePreviewPlaceholder.hidden = false;
      };
    }
    const highresLabel = scene.wayback ? `高清 Wayback ${scene.wayback.date}` : "高清当前参考";
    els.mapSource.textContent = tileUrl
      ? `${state.activeYear}：RGB · 假彩色 · ${highresLabel} · NDVI`
      : `${state.activeYear}：场景预览 · ${highresLabel} · NDVI`;
    els.mapZoomHint.textContent = tileUrl ? `${state.activeYear} RGB · 10 m` : "仅底图";
    els.highresLayerStatus.textContent = formatHighresStatus(scene);
    setAuxiliaryParameters(scene);
  }

  function addTileJsonLayer(tileJson, map, attribution) {
    const tileUrl = tileJson?.tiles?.[0];
    if (!map || !tileUrl) return null;
    const tileBounds = Array.isArray(tileJson.bounds) && tileJson.bounds.length === 4
      ? window.L.latLngBounds(
        [tileJson.bounds[1], tileJson.bounds[0]],
        [tileJson.bounds[3], tileJson.bounds[2]],
      )
      : undefined;
    return window.L.tileLayer(tileUrl, {
      maxZoom: Math.min(Number(tileJson.maxzoom || 20), 23),
      minZoom: Number(tileJson.minzoom || 0),
      opacity: 0.92,
      crossOrigin: true,
      noWrap: true,
      bounds: tileBounds,
      attribution,
    }).addTo(map);
  }

  function setSceneMeta(scene) {
    if (!scene?.item) {
      els.sceneDate.textContent = "尚未加载";
      els.sceneSubline.textContent = "选择年份后加载一景代表性影像";
      els.sceneCloudTag.textContent = "云量 —";
      els.sceneTileTag.textContent = "RGB · 假彩色 · NDVI";
      els.highresLayerStatus.textContent = "当前高清底图";
      els.scenePreview.hidden = true;
      els.scenePreview.removeAttribute("src");
      els.scenePreviewPlaceholder.hidden = false;
      return;
    }
    const item = scene.item;
    const date = getSceneDate(item);
    const formattedDate = date ? date.toISOString().slice(0, 10) : "日期未知";
    const cloud = getCloudCover(item);
    els.sceneDate.textContent = formattedDate;
    const highresLabel = scene.wayback ? `Wayback ${scene.wayback.date}` : "高清当前参考";
    els.sceneSubline.textContent = `${item.id || "Sentinel-2 scene"} · ${item.properties?.platform || "S2"} · ${highresLabel} · ${formatHighresRelation(scene)}`;
    els.sceneCloudTag.textContent = `云量 ${cloud.toFixed(1)}%`;
    els.sceneTileTag.textContent = [
      scene.tileJson?.tiles?.[0] ? "RGB 10 m" : "RGB 预览",
      scene.falseColorTileJson?.tiles?.[0] ? "NIR-R-G" : "假彩色—",
      scene.ndviTileJson?.tiles?.[0] ? "NDVI" : "NDVI—",
    ].join(" · ");
  }

  function formatHighresStatus(scene) {
    if (!scene?.wayback) return "当前高清参考";
    return `Wayback ${scene.wayback.date} · ${formatHighresRelation(scene)}`;
  }

  function formatHighresRelation(scene) {
    if (!scene?.wayback?.date) return "年度参考";
    const sentinelDate = getSceneDate(scene.item);
    const waybackTime = Date.parse(`${scene.wayback.date}T00:00:00Z`);
    if (!sentinelDate || !Number.isFinite(waybackTime)) return "年度参考";
    const distanceDays = Math.round(Math.abs(waybackTime - sentinelDate.getTime()) / 86400000);
    return distanceDays <= 60 ? "近同期参考" : "年度参考";
  }

  function setSceneLoading(isLoading) {
    els.mapLoading.hidden = !isLoading;
    if (isLoading) setSceneStatus("检索影像…", "loading");
  }

  function setAuxiliaryParameters(scene, mode = "ready") {
    if (!els.auxStatus) return;
    [els.auxNdvi, els.auxNdwi, els.auxNdbi, els.auxNdmi, els.auxB03, els.auxB04, els.auxB08, els.auxB11].forEach((element) => {
      element.textContent = "—";
    });
    const setBias = (key, label, detail) => {
      els.auxBiasCard.dataset.bias = key;
      els.auxBias.textContent = label;
      els.auxHint.textContent = detail;
    };
    els.auxStatus.classList.remove("is-loading", "is-error", "is-ready");
    if (mode === "loading") {
      els.auxStatus.textContent = "读取像元…";
      els.auxStatus.classList.add("is-loading");
      setBias("loading", "读取中…", "正在读取当前点的 B03 / B04 / B08 / B11 光谱值。");
      return;
    }
    if (mode === "error") {
      els.auxStatus.textContent = "参数不可用";
      els.auxStatus.classList.add("is-error");
      setBias("error", "暂不可判定", "当前影像请求失败，参数暂不可用；请直接结合四窗影像判读。");
      return;
    }
    const names = scene?.pointValues?.band_names || [];
    const values = scene?.pointValues?.values || [];
    if (!names.length || !values.length) {
      els.auxStatus.textContent = "未返回参数";
      els.auxStatus.classList.add("is-error");
      setBias("error", "暂不可判定", "当前场景没有返回点位光谱值，请结合四窗影像判读。");
      return;
    }
    const bandValue = (band) => {
      const index = names.indexOf(`${band}_b1`);
      const value = Number(values[index]);
      return Number.isFinite(value) ? value : null;
    };
    const normalizedDifference = (first, second) => {
      if (!Number.isFinite(first) || !Number.isFinite(second) || first + second === 0) return null;
      return (first - second) / (first + second);
    };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const b03 = bandValue("B03");
    const b04 = bandValue("B04");
    const b08 = bandValue("B08");
    const b11 = bandValue("B11");
    const rawNdvi = normalizedDifference(b08, b04);
    const ndvi = rawNdvi === null ? null : clamp(rawNdvi, 0, 1);
    const ndwi = normalizedDifference(b03, b08);
    const ndbi = normalizedDifference(b11, b08);
    const ndmi = normalizedDifference(b08, b11);
    const formatMetric = (value) => value === null ? "—" : value.toFixed(2);
    const formatBand = (value) => {
      if (value === null) return "—";
      return Math.abs(value) < 2 ? value.toFixed(3) : value.toFixed(0);
    };
    els.auxNdvi.textContent = formatMetric(ndvi);
    els.auxNdwi.textContent = formatMetric(ndwi);
    els.auxNdbi.textContent = formatMetric(ndbi);
    els.auxNdmi.textContent = formatMetric(ndmi);
    els.auxB03.textContent = formatBand(b03);
    els.auxB04.textContent = formatBand(b04);
    els.auxB08.textContent = formatBand(b08);
    els.auxB11.textContent = formatBand(b11);
    els.auxStatus.textContent = "像元参数已同步";
    els.auxStatus.classList.add("is-ready");

    const bias = inferAuxiliaryBias({ ndvi, ndwi, ndbi, ndmi });
    setBias("ready", `偏向：${bias.label}`, bias.detail);
  }

  function inferAuxiliaryBias({ ndvi, ndwi, ndbi, ndmi }) {
    if ([ndvi, ndwi, ndbi, ndmi].every((value) => value === null)) {
      return { label: "不确定", detail: "指数没有有效值，请结合四窗影像和周边纹理复核。" };
    }
    if (ndwi !== null && ndwi >= 0.18 && (ndvi === null || ndvi < 0.5)) {
      return { label: "水域", detail: "NDWI 偏高且植被信号较弱，优先核查开放水面。" };
    }
    if (ndbi !== null && ndbi >= 0.12 && (ndvi === null || ndvi < 0.45)) {
      return { label: "建设用地", detail: "NDBI 偏高且植被信号较弱，优先核查建筑或不透水面。" };
    }
    if (ndvi !== null && ndvi >= 0.65) {
      return { label: "林地", detail: "NDVI 较高，优先核查连续乔木冠层和林地纹理。" };
    }
    if (ndvi !== null && ndvi >= 0.42) {
      return { label: "灌草地", detail: "NDVI 中高，优先核查灌丛、草坡或撂荒地表。" };
    }
    if (ndvi !== null && ndvi >= 0.25) {
      if (ndmi !== null && ndmi >= 0.1) {
        return { label: "水田", detail: "有一定植被和水分信号，优先核查水稻种植或湿润农田。" };
      }
      return { label: "旱地", detail: "植被信号中等、水分信号不强，优先核查旱作或园地。" };
    }
    return { label: "不确定", detail: "植被、水体和建设信号都不突出，建议直接选择不确定并复核周边纹理。" };
  }

  function setSceneStatus(text, mode = "idle") {
    els.sceneStatusText.textContent = text;
    els.sceneStatus.classList.remove("is-loading", "is-ready", "is-error");
    if (mode === "loading") els.sceneStatus.classList.add("is-loading");
    if (mode === "ready") els.sceneStatus.classList.add("is-ready");
    if (mode === "error") els.sceneStatus.classList.add("is-error");
    els.sceneStatus.querySelector(".scene-status-icon").textContent = mode === "loading" ? "◌" : mode === "ready" ? "●" : mode === "error" ? "!" : "○";
  }

  function clearSceneLayers() {
    if (state.sentinelLayer && state.map) state.map.removeLayer(state.sentinelLayer);
    if (state.falseColorLayer && state.falseColorMap) state.falseColorMap.removeLayer(state.falseColorLayer);
    if (state.highresHistoricalLayer && state.highresMap) state.highresMap.removeLayer(state.highresHistoricalLayer);
    if (state.ndviLayer && state.ndviMap) state.ndviMap.removeLayer(state.ndviLayer);
    state.sentinelLayer = null;
    state.falseColorLayer = null;
    state.highresHistoricalLayer = null;
    state.ndviLayer = null;
  }

  function setSaveStatus(text, mode = "ready") {
    els.saveStatusText.textContent = text;
    els.saveStatus.classList.remove("is-saved", "is-error");
    if (mode === "saved") els.saveStatus.classList.add("is-saved");
    if (mode === "error") els.saveStatus.classList.add("is-error");
  }

  function queuePersist() {
    setSaveStatus("待保存…", "ready");
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => saveLocal(), 260);
  }

  function saveLocal() {
    if (!state.rows.length || !state.storageKey) return;
    const rowsById = {};
    state.rows.forEach((row) => {
      if (!row.point_id) return;
      rowsById[row.point_id] = {};
      state.headers.forEach((header) => {
        if (/^label_\d{4}$/.test(header) || ["orchard", "abandoned", "construction", "uncertain_reason", "note"].includes(header)) {
          rowsById[row.point_id][header] = row[header] || "";
        }
      });
    });
    try {
      localStorage.setItem(state.storageKey, JSON.stringify({ savedAt: new Date().toISOString(), rowsById }));
      setSaveStatus("已保存本机缓存", "saved");
    } catch (error) {
      console.error(error);
      setSaveStatus("缓存保存失败", "error");
    }
  }

  function restoreLocalEdits() {
    try {
      const raw = localStorage.getItem(state.storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.rowsById) return;
      state.rows.forEach((row) => {
        const patch = saved.rowsById[row.point_id];
        if (patch) Object.assign(row, patch);
      });
    } catch (error) {
      console.error(error);
    }
  }

  function hasStoredEdits() {
    try {
      return Boolean(state.storageKey && localStorage.getItem(state.storageKey));
    } catch {
      return false;
    }
  }

  function clearLocalAnnotations() {
    if (!state.rows.length || !state.storageKey) return;
    const confirmed = window.confirm("清除当前 CSV 的本机标注缓存？这不会删除已导出的文件，但会丢失浏览器内未导出的修改。");
    if (!confirmed) return;
    try {
      localStorage.removeItem(state.storageKey);
      state.rows.forEach((row) => {
        state.headers.forEach((header) => {
          if (/^label_\d{4}$/.test(header) || ["orchard", "abandoned", "construction", "uncertain_reason", "note"].includes(header)) {
            row[header] = "";
          }
        });
      });
      renderAll();
      showToast("本机标注缓存已清除");
      setSaveStatus("缓存已清除", "ready");
    } catch (error) {
      console.error(error);
      showToast("清除缓存失败");
    }
  }

  function getActiveRow() {
    return state.rows[state.activeIndex] || null;
  }

  function getLabelField(year) {
    return `label_${year}`;
  }

  function getCanonicalLabel(value) {
    const label = String(value || "").trim();
    if (!label) return "";
    return LABEL_ALIASES.get(label) || (CATEGORIES.some((category) => category.label === label) ? label : label);
  }

  function isFlagSet(value) {
    return ["1", "true", "yes", "y", "是", "TRUE"].includes(String(value || "").trim());
  }

  function getSceneDate(item) {
    const raw = item?.properties?.datetime || item?.properties?.start_datetime;
    if (!raw) {
      const match = String(item?.id || "").match(/_(\d{8})T/);
      if (match) return new Date(`${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}T00:00:00Z`);
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getCloudCover(item) {
    const value = Number(item?.properties?.["eo:cloud_cover"] ?? item?.properties?.cloud_cover ?? 100);
    return Number.isFinite(value) ? value : 100;
  }

  function getStorageKey(fileName, headers) {
    const signature = `${fileName}|${headers.join(",")}`.slice(0, 240);
    return `${STORAGE_PREFIX}${signature}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2800);
  }
})();
