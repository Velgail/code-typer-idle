// Declarative choices and compatibility rules shared by estimates and play.
// No user data, DOM, clock, network, or random source is accessed here.
export const OPTIONAL_CHOICES = {
  playModeId: ['playMode', 'solo'], networkId: ['network', 'none'],
  syncId: ['sync', 'none'], cameraId: ['camera', 'shared-screen'],
  salesModelId: ['salesModel', 'free']
};
const scalarFields = ['genreId', 'presentationId', 'audioId', 'inputId', 'engineId', ...Object.keys(OPTIONAL_CHOICES)];
const choices = value => typeof value === 'string' ? [value] : value;
const ids = values => values.map(value => typeof value === 'string' ? value : value.id);

export function normalizeAdditionalChoices(raw, plan, catalog, fail) {
  const featureIds = new Set(ids(plan.features));
  const legacyOnline = ['network-authority', 'persistent-world', 'matchmaking', 'social-chat', 'sharding'].some(id => featureIds.has(id));
  for (const [field, [axis, fallback]] of Object.entries(OPTIONAL_CHOICES)) {
    if (!catalog.axes?.[axis]) {
      if (raw[field] !== undefined) fail('UNKNOWN_ID', 'This catalog does not define the requested choice', { field });
      continue;
    }
    let value = raw[field];
    if (value === undefined) {
      if (field === 'playModeId' && legacyOnline) value = featureIds.has('persistent-world') ? 'shared-world' : 'online-versus';
      else if (field === 'networkId') value = /^online-|^shared-world$/.test(plan.playModeId || '') ? 'dedicated' : 'none';
      else if (field === 'syncId') value = plan.networkId && plan.networkId !== 'none' ? 'state-sync' : 'none';
      else if (field === 'cameraId') value = /^online-|^shared-world$/.test(plan.playModeId || '') ? 'per-player' : fallback;
      else value = fallback;
    }
    if (typeof value !== 'string' || !catalog.axes[axis].some(row => row.id === value)) fail('UNKNOWN_ID', 'Unknown planning choice', { field, id: value });
    plan[field] = value;
  }
  const defaultStores = [];
  if (plan.targets.includes('ios')) defaultStores.push('mobile-store');
  if (plan.targets.includes('console')) defaultStores.push('console-store');
  if (!defaultStores.length || plan.targets.some(id => ['windows', 'linux', 'macos', 'browser'].includes(id))) defaultStores.push('direct');
  for (const [field, rows, fallback, max] of [
    ['storeIds', catalog.axes?.store, defaultStores, 10], ['themeIds', catalog.themes, [], 3]
  ]) {
    if (!rows) {
      if (raw[field] !== undefined) fail('UNKNOWN_ID', 'This catalog does not define the requested choices', { field });
      continue;
    }
    const requested = raw[field] ?? fallback;
    if (!Array.isArray(requested) || requested.length > max || field === 'storeIds' && !requested.length) fail('INVALID_SCHEMA', 'Invalid number of planning choices', { field, max });
    const result = [];
    for (const key of requested) {
      if (typeof key !== 'string' || !rows.some(row => row.id === key)) fail('UNKNOWN_ID', 'Unknown planning choice', { field, id: key });
      if (!result.includes(key)) result.push(key);
    }
    plan[field] = result.sort();
  }
  const selected = additionalSelections(plan, catalog);
  for (const row of selected) for (const [key, value] of Object.entries(row.quantityDefaults || {})) {
    if (raw.quantities?.[key] === undefined) plan.quantities[key] = value;
  }
  for (const [key, value] of Object.entries(plan.quantities)) {
    const rule = catalog.quantityDefinitions?.[key];
    if (rule && (!Number.isSafeInteger(value) || value < (rule.min ?? 0) || value > (rule.max ?? Number.MAX_SAFE_INTEGER))) fail('INVALID_QUANTITY', 'Project capacity is outside its supported range', { key, value });
  }
  for (const row of selected) for (const [key, rule] of Object.entries(row.quantityLimits || {})) {
    const value = plan.quantities[key];
    if (value === undefined || value < (rule.min ?? 0) || value > (rule.max ?? Number.MAX_SAFE_INTEGER)) fail('INVALID_QUANTITY', 'Capacity does not fit the chosen mode', { selection: row.id, key, value, ...rule });
  }
  return plan;
}

export function additionalSelections(plan, catalog) {
  const selected = [];
  for (const [field, [axis]] of Object.entries(OPTIONAL_CHOICES)) {
    const row = catalog.axes?.[axis]?.find(row => row.id === plan[field]);
    if (row) selected.push({ axis, ...row });
  }
  for (const [field, axis, rows] of [['storeIds', 'store', catalog.axes?.store], ['themeIds', 'theme', catalog.themes]]) {
    for (const key of plan[field] || []) {
      const row = rows?.find(row => row.id === key);
      if (row) selected.push({ axis, ...row });
    }
  }
  return selected;
}

function conditionMatches(condition, plan, selected, fail) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) fail('INVALID_SCHEMA', 'A planning constraint needs a condition');
  for (const [field, requested] of Object.entries(condition)) {
    const values = choices(requested);
    if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string')) fail('INVALID_SCHEMA', 'Constraint values must be identifiers', { field });
    if (scalarFields.includes(field)) { if (!values.includes(plan[field])) return false; }
    else if (field === 'targetsAny') { if (!values.some(value => plan.targets.includes(value))) return false; }
    else if (['storeIdsAny', 'storesAny'].includes(field)) { if (!values.some(value => plan.storeIds?.includes(value))) return false; }
    else if (['themeIdsAny', 'themesAny'].includes(field)) { if (!values.some(value => plan.themeIds?.includes(value))) return false; }
    else if (field === 'featuresAny') { if (!values.some(value => selected.has(value))) return false; }
    else if (field === 'featuresAll') { if (!values.every(value => selected.has(value))) return false; }
    else if (field === 'missingAllFeatures') { if (values.some(value => selected.has(value))) return false; }
    else fail('INVALID_SCHEMA', 'Unknown planning constraint field', { field });
  }
  return true;
}

export function validateAdditionalChoices(plan, context, selected, fail) {
  const warnings = [];
  if (context.engine.supportedTargets) {
    const unsupported = plan.targets.filter(id => !context.engine.supportedTargets.includes(id));
    if (unsupported.length) fail('CONFLICT', 'The selected engine has no supported exporter for this target', { engine: context.engine.id, targets: unsupported });
  }
  for (const row of additionalSelections(plan, context.catalog)) {
    if (row.permittedTargets && !plan.targets.some(id => row.permittedTargets.includes(id))) fail('CONFLICT', 'The distribution channel does not serve a selected target', { selection: row.id, targets: plan.targets });
  }
  for (const rule of context.catalog.constraints || []) {
    if (!rule.id || typeof rule.message !== 'string' || !['warning', 'error'].includes(rule.severity || 'error')) fail('INVALID_SCHEMA', 'Invalid planning constraint', { id: rule.id });
    if (conditionMatches(rule.when, plan, selected, fail)) {
      if (rule.severity === 'warning') warnings.push({ code: rule.id, message: rule.message });
      else fail('CONFLICT', rule.message, { constraint: rule.id });
    }
  }
  return warnings;
}

export function estimateSalesTerms(plan, catalog, engine, fail, selected = new Map()) {
  const model = catalog.axes?.salesModel?.find(row => row.id === plan.salesModelId);
  if (!model) return null;
  const economics = { ...(model.economics || {}) };
  for (const [key, value] of Object.entries(economics)) if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('INVALID_NUMBER', 'Invalid commercial coefficient', { key });
  const stores = (plan.storeIds || []).map(id => catalog.axes.store.find(row => row.id === id));
  const purchaseStores = stores.filter(row => row.supportsPurchases !== false);
  const storeWeight = purchaseStores.reduce((sum, row) => sum + (row.audienceMultiplier ?? 1), 0);
  const storeFeeRate = storeWeight ? purchaseStores.reduce((sum, row) => sum + (row.commissionRate || 0) * (row.audienceMultiplier ?? 1), 0) / storeWeight : 0;
  const engineFeeRate = engine.revenueShareRate || 0;
  if (storeFeeRate > 1 || engineFeeRate < 0 || engineFeeRate > 1) fail('INVALID_NUMBER', 'Revenue share must be a fraction');
  const marketing = [...selected.values()].filter(feature => feature.marketReach);
  const marketingReach = marketing.reduce((sum, feature) => sum + Math.max(0, Math.min(feature.marketReach, feature.marketReachCap ?? feature.marketReach)), 0);
  const genreMarket = catalog.genreMarkets?.[plan.genreId] || null;
  const themeRows = (plan.themeIds || []).map(id => catalog.themes.find(row => row.id === id));
  const themeAudienceMultiplier = Math.max(1, ...themeRows.map(row => row.genreAudienceFocus?.includes(plan.genreId) ? 1.12 : row.audienceTags?.some(tag => genreMarket?.audienceTags?.includes(tag)) ? 1.06 : 1));
  return { ...economics, modelId: model.id, storeIds: plan.storeIds, storeFeeRate, engineFeeRate,
    genreMarket, themeAudienceMultiplier,
    marketingReach,
    marketingAudienceTags: [...new Set(marketing.flatMap(feature => feature.reachAudienceTags || []))],
    themeAudienceFocus: (plan.themeIds || []).map(id => {
      const row = catalog.themes.find(row => row.id === id);
      return { id, audienceTags: row.audienceTags || [], genreAudienceFocus: row.genreAudienceFocus || [] };
    }),
    requiresBaseRelease: model.requiresBaseRelease === true,
    storeAudienceMultiplier: stores.length ? Math.max(...stores.map(row => row.audienceMultiplier ?? 1)) : 1,
    feePayees: purchaseStores.map(row => ({ storeId: row.id, name: row.name, rate: row.commissionRate || 0, payee: row.feePayee || row.name })) };
}

export function assessCompatibility(context, selected) {
  const { catalog, genre } = context, plan = context.plan;
  const known = [], unknown = [];
  const definitions = catalog.affinities || [];
  const add = (relation, featureId, themeId) => {
    const id = relation.id || [genre.id, featureId || '', themeId || '', relation.relation].join(':');
    if (known.some(row => row.id === id)) return;
    known.push({ id, genreId: genre.id, ...(featureId ? { featureId } : {}), ...(themeId ? { themeId } : {}), relation: relation.relation || relation.status, note: relation.note || relation.reason || '', risk: relation.risk || {} });
  };
  const genreMatches = row => !row.genreId && !row.genreIds || row.genreId === genre.id || row.genreIds?.includes(genre.id);
  for (const [key] of selected) {
    const relations = definitions.filter(row => genreMatches(row) && (row.featureId === key || row.featureIds?.includes(key)) && (!row.themeId || plan.themeIds?.includes(row.themeId)));
    if (!relations.length) unknown.push({ genreId: genre.id, featureId: key, status: 'unknown' });
    for (const row of relations) add(row, key, row.themeId);
  }
  for (const themeId of plan.themeIds || []) {
    const relations = definitions.filter(row => genreMatches(row) && row.themeId === themeId && !row.featureId && !row.featureIds);
    if (!relations.length) unknown.push({ genreId: genre.id, themeId, status: 'unknown' });
    for (const row of relations) add(row, null, themeId);
  }
  const risk = { integration: 0, design: 0, market: 0 };
  for (const row of known) for (const key of Object.keys(risk)) risk[key] = Math.min(1, risk[key] + Math.max(0, Math.min(1, row.risk[key] || 0)));
  return { known, unknown, risk };
}
