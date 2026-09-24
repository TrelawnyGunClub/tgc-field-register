// ============================================================
// Hunter's Report (NEPA Form A) — real-data integration
// Drop into index.html alongside the other tab render functions.
// Depends on: state.sessionIndex, state.sessions, state.properties, state.species
// (all already populated by loadState()/bootstrap on the live app)
// ============================================================

// --- 1. Fill this in once the species naming is confirmed with Kurt ---
// Left side: exact string as it appears in state.species (Setup tab)
// Right side: the Form A column it should feed
const SPECIES_TO_FORM_COL = {
  "BALDPATE":  "WCPI",   // White-crowned Pigeon — CONFIRM
  "WHITE WING": "WWDO",  // White-winged Dove — CONFIRM
  "PALOMA":    "MODO",   // Mourning Dove? — CONFIRM (or is this ZEND?)
  // "ZENAIDA DOVE": "ZEND"   <-- add once/if this species exists in Setup
};
const FORM_COLS = ["WWDO", "WCPI", "ZEND", "MODO"];

// --- 2. Parish / Habitat, merged onto SEED_PROPERTIES from PropertyMapping.xlsx ---
// (This block replaces/extends the existing SEED_PROPERTIES seed — merge by name.)
const PROPERTY_PARISH_HABITAT = {
  "ARCADIA": {parish:"TRELAWNY", habitat:"FLD"},
  "BARRETT HALL": {parish:"ST. JAMES", habitat:"IW"},
  "GAZA": {parish:"TRELAWNY", habitat:"FLD"},
  "HYDE HALL": {parish:"TRELAWNY", habitat:"FLD"},
  "ROSYLN POND": {parish:"TRELAWNY", habitat:"FLD"},
  "SCHAWFIELD": {parish:"TRELAWNY", habitat:"FLD"},
  "BRYAN CASTLE": {parish:"TRELAWNY", habitat:"FLD"},
  "KIRKPATRICK": {parish:"ST. JAMES", habitat:"IW"},
  "MCKENZIE LANDS, KIRKPATRICK": {parish:"ST. JAMES", habitat:"IW"},
  "MURRAY LANDS, KIRKPATRICK": {parish:"ST. JAMES", habitat:"IW"},
  "NEW KIRKPATRICK": {parish:"ST. JAMES", habitat:"IW"},
  "PARK PEN, KIRKPATRICK": {parish:"ST. JAMES", habitat:"IW"},
  // ...remaining ~24 default to TRELAWNY / IW below
};
function parishHabitatFor(propName) {
  return PROPERTY_PARISH_HABITAT[propName] || {parish: "TRELAWNY", habitat: "IW"};
}

// --- 3. Where a hunter's harvest actually attaches (moved stand wins over draw) ---
function actualPropertyFor(session, name) {
  const moved = (session.movedTo || {})[name];
  if (moved && moved.property) return moved.property;
  const drawn = (session.assignments || {})[name];
  return drawn ? drawn.property : null;
}

// --- 4. Core aggregation: property -> week -> session slot -> {counts, didNotShoot} ---
function buildHuntersReportData() {
  const sessions = state.sessionIndex.map(id => state.sessions[id]).filter(Boolean);
  const byProperty = {}; // propName -> { "WK-1|SATAM": {WWDO:0,...,didNotShoot:0}, ... }

  for (const s of sessions) {
    const cellKey = `${s.weekendLabel}|${s.day}`;

    // Birds: attribute each hunter's bag to the property they actually stood at.
    Object.entries(s.bags || {}).forEach(([name, speciesCounts]) => {
      const prop = actualPropertyFor(s, name);
      if (!prop) return; // no stand on record — can't attribute to a property
      byProperty[prop] = byProperty[prop] || {};
      byProperty[prop][cellKey] = byProperty[prop][cellKey] || emptyCell();
      Object.entries(speciesCounts).forEach(([sp, n]) => {
        const col = SPECIES_TO_FORM_COL[sp];
        if (col) byProperty[prop][cellKey][col] += n;
      });
    });

    // Did Not Shoot: attribute to the property they were assigned/moved to,
    // since that's the ground truth of where they were supposed to be.
    Object.keys(s.notShooting || {}).forEach(name => {
      const prop = actualPropertyFor(s, name);
      if (!prop) return;
      byProperty[prop] = byProperty[prop] || {};
      byProperty[prop][cellKey] = byProperty[prop][cellKey] || emptyCell();
      byProperty[prop][cellKey].didNotShoot += 1;
    });
  }
  return byProperty;
}
function emptyCell() {
  return {WWDO:0, WCPI:0, ZEND:0, MODO:0, didNotShoot:0};
}

// --- 5. Render: one row per property, columns = WK1..WK6 x (SatAM/SatPM/SunAM) ---
const REPORT_SESSIONS = [
  {key:"SATAM", label:"Sat AM"}, {key:"SATPM", label:"Sat PM"}, {key:"SUNAM", label:"Sun AM"}
];
function renderHuntersReport(weekLabels /* e.g. ["WK - 1", ..., "WK - 6"] */) {
  const data = buildHuntersReportData();
  const props = (state.properties || []).map(p => p.name).sort();

  let head = `<tr><th>Property</th><th>Parish</th><th>Habitat</th>`;
  weekLabels.forEach(wk => REPORT_SESSIONS.forEach(sess =>
    head += `<th>${wk}<br>${sess.label}<br><small>${FORM_COLS.join("/")}/DNS</small></th>`
  ));
  head += `</tr>`;

  let rows = props.map(propName => {
    const ph = parishHabitatFor(propName);
    let cells = weekLabels.map(wk => REPORT_SESSIONS.map(sess => {
      const cell = (data[propName] || {})[`${wk}|${sess.key}`] || emptyCell();
      return `<td>${FORM_COLS.map(c => cell[c]).join("/")}/${cell.didNotShoot}</td>`;
    }).join("")).join("");
    return `<tr><td>${propName}</td><td>${ph.parish}</td><td>${ph.habitat}</td>${cells}</tr>`;
  }).join("");

  return `<table class="hunters-report">${head}${rows}</table>`;
}
