import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PLANNING_CATALOG, PLANNING_EXAMPLES } from '../src/planningcatalog.js';
import { estimatePlan, amendPlan } from '../src/planning.js';

const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const yen = value => `¥${number(value)}`;
const skills = ['syntax', 'design', 'graphics', 'systems'];
const sumRequirements = requirements => skills.map(id => number(requirements[id] || 0)).join(' / ');
const label = entry => entry.name || entry.label || entry.id;
const pair = (entry, value) => `  ${label(entry)}: ${value}`;
const sourceNames = { self: '自作', license: '利用権を購入', commission: '制作を委託' };
const warningNames = {
  FICTIONAL_COEFFICIENTS: '行数・価格はこのゲームの見積単位です。実在エンジンの料金や現実の最少行数は表しません。',
  NO_MARKET_PREDICTION: 'コード量や機能数を増やしても、品質・プレイ時間・売上は自動では増えません。'
};
const choiceName = (entries, id) => entries.find(entry => entry.id === id)?.name || id;
const featureName = id => choiceName(PLANNING_CATALOG.features, id);

export function describeChoices(plan) {
  const { axes, genres, engines } = PLANNING_CATALOG;
  const features = plan.features.map(feature => `${featureName(feature.id)}${feature.quantity > 1 ? ` ×${number(feature.quantity)}` : ''}`);
  const quantities = Object.entries(plan.quantities || {}).map(([id, value]) => `${({ concurrentPlayers: '同時接続', sensorySessions: '感覚I/O接続' })[id] || id} ${number(value)}`);
  const sources = Object.entries(plan.assetSources || {}).map(([id, source]) => {
    const asset = PLANNING_CATALOG.features.flatMap(feature => feature.assets || []).find(asset => asset.id === id);
    return `${asset?.name || id}: ${sourceNames[source]}`;
  });
  return [
    `遊び: ${choiceName(genres, plan.genreId)} / 表現: ${choiceName(axes.presentation, plan.presentationId)} / 音: ${choiceName(axes.audio, plan.audioId)}`,
    `入力: ${choiceName(axes.input, plan.inputId)} / 基盤: ${choiceName(engines, plan.engineId)} / 実行先: ${plan.targets.map(id => choiceName(axes.platform, id)).join('・')}`,
    `追加構成: ${[...features, ...quantities].join('、') || 'なし'}`,
    `素材調達: ${sources.join('、') || '自作'}`
  ];
}

export function summaryRows(examples = PLANNING_EXAMPLES) {
  return examples.map(example => {
    const estimate = estimatePlan(example.plan);
    return { id: example.id, name: example.name, description: example.description || '', plan: estimate.plan, ...estimate.totals, requirements: estimate.requirements };
  });
}

export function describeEstimate(estimate) {
  const { totals, requirements } = estimate;
  const result = [
    ...describeChoices(estimate.plan), '',
    `実装: ${number(totals.codeLines)} 行相当 / ${number(totals.codeCharacters)} 文字`,
    `必要技術（文法 / 設計 / 描画 / 基盤）: ${sumRequirements(requirements)}`,
    `素材の自作作業: ${number(totals.assetWork)} 作業量`,
    `外部への初期支払: ${yen(totals.upfrontCost)}`,
    `運営費: ${yen(totals.recurringCostPerDay)} / ゲーム内日`,
    '', '実装の内訳:',
    ...estimate.features.map(feature => pair(feature, `${number(feature.codeLines)} 行${feature.quantity > 1 ? ` / 数量 ${number(feature.quantity)}` : ''}`)),
    ...estimate.integrations.map(integration => pair(integration, `${number(integration.codeLines)} 行（統合）`)),
    '', '素材:',
    ...estimate.assets.map(asset => pair(asset,
      `${number(asset.quantity)} ${asset.unit} / ${sourceNames[asset.source]} / 自作 ${number(asset.selfWork)} 作業量 / 支払 ${yen(asset.cost)}${asset.payee ? ` → ${asset.payee}` : ''}`)),
    '', '支払先と費用:',
    ...estimate.costs.map(cost => pair(cost, `${yen(cost.amount)}${cost.kind === 'recurring' ? ' / ゲーム内日' : ' / 企画'} → ${cost.payee}`)),
    '', '相性の仮説:',
    ...estimate.compatibility.known.map(item => `  ${JSON.stringify(item)}`),
    `  未検証の組み合わせ: ${estimate.compatibility.unknown.length}件`,
    ...estimate.warnings.map(warning => `注意: ${typeof warning === 'string' ? warning : warningNames[warning.code] || warning.message}`)
  ];
  return result.join('\n');
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (['--json', '--list', '--catalog', '--help'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--example', '--plan', '--snapshot', '--amend'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} の値を指定してください。`);
      options[arg.slice(2)] = value;
    } else throw new Error(`不明な引数: ${arg}`);
  }
  if ([options.example, options.plan, options.snapshot].filter(Boolean).length > 1) throw new Error('--example / --plan / --snapshot は1つだけ選べます。');
  if (options.snapshot && !options.amend) throw new Error('--snapshot には --amend が必要です。');
  return options;
}

async function jsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log([
      '企画の積み上げ見積り（設計用。プレイ中のセーブは変更しません）',
      'npm run planning                         代表企画の選択内容と見積り',
      'npm run planning -- --list               比較企画のID',
      'npm run planning -- --catalog --json     ジャンル・機能・基盤の全データ',
      'npm run planning -- --example ID         企画の分解',
      'npm run planning -- --plan plan.json --json',
      'npm run planning -- --plan plan.json --amend addition.json --json',
      'npm run planning -- --snapshot estimate.json --amend addition.json --json',
      '', '行数・価格は固定世界のゲーム内バランス値です。品質・面白さ・プレイ時間・売上は算定しません。'
    ].join('\n'));
    return;
  }
  if (options.catalog) {
    if (options.json) console.log(JSON.stringify(PLANNING_CATALOG, null, 2));
    else {
      console.log(`ジャンル ${PLANNING_CATALOG.genres.length} / 機能 ${PLANNING_CATALOG.features.length}`);
      const groups = [
        ['ジャンル', PLANNING_CATALOG.genres], ['視覚表現', PLANNING_CATALOG.axes.presentation],
        ['音', PLANNING_CATALOG.axes.audio], ['入力', PLANNING_CATALOG.axes.input],
        ['基盤', PLANNING_CATALOG.engines], ['実行先', PLANNING_CATALOG.axes.platform],
        ['追加機能・内容', PLANNING_CATALOG.features.filter(feature => !['foundation', 'platform', 'presentation', 'audio', 'input'].includes(feature.category))]
      ];
      for (const [name, entries] of groups) {
        console.log(`\n${name}:`);
        for (const entry of entries) console.log(`  ${entry.id}\t${entry.name}`);
      }
      console.log('\n素材調達: 自作 / 利用権を購入 / 制作を委託');
    }
    return;
  }
  if (options.list) {
    console.log(options.json ? JSON.stringify(PLANNING_EXAMPLES, null, 2) : PLANNING_EXAMPLES.map(example => `${example.id}\t${example.name}`).join('\n'));
    return;
  }
  let estimate;
  if (options.snapshot) estimate = await jsonFile(options.snapshot);
  else if (options.plan) estimate = estimatePlan(await jsonFile(options.plan));
  else if (options.example) {
    const example = PLANNING_EXAMPLES.find(example => example.id === options.example);
    if (!example) throw new Error(`比較企画がありません: ${options.example}`);
    estimate = estimatePlan(example.plan);
  }
  if (options.amend) {
    if (!estimate) throw new Error('--amend には --example / --plan / --snapshot が必要です。');
    const amended = amendPlan(estimate, await jsonFile(options.amend));
    if (options.json) console.log(JSON.stringify(amended, null, 2));
    else {
      console.log(describeEstimate(amended.snapshot));
      console.log([
        '',
        `追加実装: ${number(amended.delta.codeLines)} 行`,
        `追加素材自作: ${number(amended.delta.assetWork)} 作業量`,
        `追加初期支払: ${yen(amended.delta.upfrontCost)}`,
        `運営費の増分: ${yen(amended.delta.recurringCostPerDay)} / ゲーム内日`
      ].join('\n'));
    }
    return;
  }
  if (estimate) {
    console.log(options.json ? JSON.stringify(estimate, null, 2) : describeEstimate(estimate));
    return;
  }
  const rows = summaryRows();
  if (options.json) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log('遊び・機能・表現・入力・基盤・実行先・内容量・素材調達を組み合わせた代表企画。行数と費用はゲーム内の見積単位です。');
    for (const row of rows) {
      console.log(`\n${row.name} (${row.id})`);
      if (row.description) console.log(row.description);
      console.log(describeChoices(row.plan).map(line => `  ${line}`).join('\n'));
      console.log(`  実装 ${number(row.codeLines)} 行 / 素材自作 ${number(row.assetWork)} 作業量 / 初期支払 ${yen(row.upfrontCost)} / 運営費 ${yen(row.recurringCostPerDay)}/日`);
      console.log(`  技術（文法 / 設計 / 描画 / 基盤）: ${sumRequirements(row.requirements)}`);
    }
    console.log('\nコード量に比例した品質・面白さ・プレイ時間・売上の加点はありません。');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`企画を見積もれません: ${error.message}`); process.exitCode = 1; });
}
