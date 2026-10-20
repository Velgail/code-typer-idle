// Wrong answers are results of specific misreadings of the displayed query.
// They are not numeric neighbours of its answer. A caller may remove a result
// that happens to coincide with the correct answer for one set of sample rows.
const total = values => values.reduce((sum, value) => sum + value, 0);
const sum = rows => total(rows.map(row => row.amount));
const low = rows => Math.min(...rows.map(row => row.amount));
const high = rows => Math.max(...rows.map(row => row.amount));
const active = rows => rows.filter(row => row.enabled === 1);
const group = (rows, id) => rows.filter(row => row.group_id === id);
const keys = rows => [...new Set(rows.map(row => row.group_id))];
const grouped = rows => keys(rows).map(id => group(rows, id));
const ordered = (rows, descending = false) => [...rows].sort((a, b) => (descending ? b.amount - a.amount : a.amount - b.amount) || a.id - b.id);
const wrong = (value, misconception, reason) => ({ value, misconception, reason });
const pairCount = (rows, predicate) => rows.reduce((count, a) => count + rows.filter(b => predicate(a, b)).length, 0);

const distractors = {
  select_amount: rows => [
    wrong(rows.find(row => row.id === 2).id, 'selected-id-instead-of-amount', 'WHEREで選んだ行のidを答えた値です。SELECTで取り出す列はamountです。'),
    wrong(rows.filter(row => row.id === 2).length, 'selected-row-count', '選ばれた行の件数を答えた値です。この問い合わせはCOUNTではなく、その行のamountを返します。'),
  ],
  count_enabled: rows => [
    wrong(rows.length, 'count-before-where', 'WHEREによる絞り込み前の全行を数えた値です。enabled = 1の行だけがCOUNTの対象になります。'),
    wrong(sum(active(rows)), 'count-as-sum-amount', '有効な行のamountを合計した値です。COUNT(*)は金額ではなく行数を数えます。'),
    wrong(rows.filter(row => row.enabled === 0).length, 'enabled-predicate-reversed', 'enabled = 0の行を数えた値です。条件はenabled = 1です。'),
  ],
  sum_amount: rows => [
    wrong(rows.length, 'sum-as-count', 'SUM(amount)をCOUNT(*)と読み違えて行数を数えた値です。'),
    wrong(high(rows), 'sum-as-max', '合計ではなく最大のamountを選んだ値です。SUMはすべての行のamountを足します。'),
    wrong(sum(active(rows)), 'unwritten-enabled-filter', 'enabled = 1の行だけを足した値です。この問い合わせには有効フラグによるWHERE条件がありません。'),
  ],
  maximum_amount: rows => [
    wrong(low(rows), 'max-as-min', 'MAXをMINと読み違えて、最小のamountを選んだ値です。'),
    wrong(sum(rows), 'max-as-sum', '最大値ではなくamountの合計を求めた値です。'),
    wrong(ordered(rows, true)[0].id, 'maximum-row-id', '最大のamountを持つ行のidを答えた値です。MAX(amount)が返すのは金額です。'),
  ],
  minimum_amount: rows => [
    wrong(high(rows), 'min-as-max', 'MINをMAXと読み違えて、最大のamountを選んだ値です。'),
    wrong(rows[0].amount, 'first-row-as-minimum', 'VALUESの先頭のamountをそのまま答えた値です。MINは行の並びにかかわらず全行の最小値を探します。'),
    wrong(ordered(rows)[0].id, 'minimum-row-id', '最小のamountを持つ行のidを答えた値です。MIN(amount)が返すのは金額です。'),
  ],
  integer_average: rows => [
    wrong(sum(rows) / rows.length, 'integer-average-cast-ignored', 'AVGが返した小数付きの平均をそのまま答えた値です。外側のCAST(... AS INTEGER)で小数部分を切り捨てます。'),
    wrong(sum(rows), 'average-as-sum', 'AVGをSUMと読み違えて、割る前の合計を答えた値です。'),
    wrong(Math.round(sum(rows) / rows.length), 'integer-cast-as-round', '平均を四捨五入した値です。このINTEGERへのCASTは小数部分を切り捨てます。'),
    wrong(Math.ceil(sum(rows) / rows.length), 'integer-cast-as-ceil', '平均を切り上げた値です。このINTEGERへのCASTは小数部分を切り捨てます。'),
  ],
  distinct_groups: rows => [
    wrong(rows.length, 'count-without-distinct', 'DISTINCTを落として、同じgroup_idを持つ行も別々に数えた値です。'),
    wrong(total(keys(rows)), 'count-distinct-as-sum', '重複を除いた分類番号を足した値です。COUNTは番号の合計ではなく種類の数を返します。'),
  ],
  case_discount: rows => [
    wrong(rows[3].amount - 1, 'case-else-unconditionally', 'WHENが成立しているのにELSEのamount - 1を使った値です。'),
    wrong(rows[3].amount + 5, 'discount-as-addition', 'WHENの枝で5を引く代わりに足した値です。'),
    wrong(rows[3].amount, 'case-returns-original-column', 'CASE内の減算をせず、元のamountを答えた値です。'),
  ],
  coalesce_missing: rows => [
    wrong(null, 'coalesce-ignored', '空集合のMAXが返すNULLで計算を止めた結果です。COALESCEがそのNULLを第2引数の0に置き換えます。'),
    wrong(high(rows), 'max-before-missing-id-filter', 'id = 99の条件を適用せず、sample全体の最大値を求めた値です。'),
  ],
  between_amounts: rows => [
    wrong(rows.filter(row => row.amount > 10 && row.amount < 25).length, 'between-as-open-interval', 'BETWEENの両端を含めず、10より大きく25より小さい行だけを数えた値です。'),
    wrong(rows.filter(row => row.amount >= 10 || row.amount <= 25).length, 'between-as-or', '下限と上限をANDではなくORで結んだ場合の件数です。BETWEENは両方を満たす行を選びます。'),
    wrong(rows.filter(row => row.amount < 10 || row.amount > 25).length, 'between-negated', '範囲内ではなく範囲外の行を数えた値です。'),
  ],
  in_identifiers: rows => [
    wrong(rows.filter(row => row.id === 1 || row.id === 3).length, 'sum-selected-as-count', 'INで選んだ行の金額を足さず、行数を数えた値です。'),
    wrong(total(rows.filter(row => row.id === 1 || row.id === 3).map(row => row.id)), 'sum-id-instead-of-amount', '選んだ行のamountではなくidを合計した値です。'),
    wrong(sum(rows), 'in-filter-ignored', 'INの条件で行を絞らず、すべてのamountを合計した値です。'),
    wrong(null, 'in-as-simultaneous-equality', 'IN (1, 3)をid = 1 AND id = 3と読み違えた結果です。その条件では該当行がなく、空集合のSUMはNULLになります。INではどちらかのidに一致すれば選ばれます。'),
  ],
  descending_limit: rows => [
    wrong(ordered(rows)[0].id, 'descending-as-ascending', 'DESCをASCと読み違えて、最小のamountを持つ行を選んだ値です。'),
    wrong(ordered(rows, true)[0].amount, 'ordered-column-as-selected-column', '並べ替えに使うamountを答えた値です。SELECTで返す列はidです。'),
    wrong(rows[0].id, 'limit-before-order', '並べ替える前にVALUESの先頭行をLIMIT 1で取った値です。ORDER BYを適用してから先頭を選びます。'),
  ],
  second_highest: rows => [
    wrong(ordered(rows, true)[0].amount, 'offset-ignored', 'OFFSET 1を適用せず、降順の先頭のamountを返した値です。'),
    wrong(ordered(rows, true)[2].amount, 'offset-skips-two', 'OFFSET 1で2行を飛ばすと読み違えた値です。飛ばすのは先頭の1行です。'),
    wrong(ordered(rows)[1].amount, 'descending-offset-as-ascending', '降順ではなく昇順で並べた後、1行を飛ばした値です。'),
    wrong(ordered(rows, true)[1].id, 'ranked-id-instead-of-amount', '選ばれた行のidを答えた値です。SELECTが返すのはamountです。'),
  ],
  remainder_filter: rows => [
    wrong(sum(rows.filter(row => row.id % 2 !== 0)), 'even-id-as-odd-id', 'id % 2 = 0を逆に読み、奇数のidの金額を足した値です。'),
    wrong(rows.filter(row => row.id % 2 === 0).length, 'filtered-sum-as-count', '偶数のidの行数を数えた値です。求めるのはamountの合計です。'),
    wrong(sum(rows.filter(row => row.amount % 2 === 0)), 'amount-parity-instead-of-id', 'idではなくamountが偶数かどうかで行を選んだ値です。'),
    wrong(sum(rows), 'remainder-filter-ignored', '剰余による絞り込みをせず、全行の金額を足した値です。'),
  ],
  combine_predicates: rows => [
    wrong(rows.filter(row => row.enabled === 1 || row.amount >= 10).length, 'and-as-or', 'ANDをORと読み違え、どちらか一方の条件だけで行を選んだ値です。'),
    wrong(active(rows).length, 'amount-predicate-ignored', 'enabled = 1だけを確認し、amount >= 10を確認しなかった件数です。'),
    wrong(rows.filter(row => row.amount >= 10).length, 'enabled-predicate-ignored', 'amount >= 10だけを確認し、有効フラグを確認しなかった件数です。'),
    wrong(sum(rows.filter(row => row.enabled === 1 && row.amount >= 10)), 'matching-count-as-amount-sum', '条件に合う行のamountを合計した値です。COUNT(*)は件数を返します。'),
  ],
  scalar_arithmetic: rows => [
    wrong(low(rows) - high(rows), 'spread-subtraction-reversed', '引き算の順序を逆にし、最小値から最大値を引いた値です。'),
    wrong(high(rows) + low(rows), 'spread-as-sum', '最大値と最小値の差ではなく和を求めた値です。'),
    wrong(high(rows), 'spread-minimum-not-subtracted', 'MAX(amount)だけを答え、MIN(amount)を引かなかった値です。'),
  ],
  group_total: rows => [
    wrong(sum(rows), 'group-selection-ignored', 'HAVINGによる分類の選択を落とし、全分類の金額を足した値です。'),
    wrong(sum(group(rows, 2)), 'wrong-group-selected', 'group_id = 1ではなく分類2の合計を答えた値です。'),
    wrong(group(rows, 1).length, 'group-sum-as-member-count', '分類1の金額の合計ではなく、分類1に属する行数を答えた値です。'),
  ],
  having_total: rows => [
    wrong(rows.filter(row => row.amount >= 25).length, 'having-sum-as-row-filter', '分類ごとのSUM(amount)ではなく、各行のamount >= 25を先に調べて数えた値です。'),
    wrong(keys(rows).length, 'having-ignored', 'HAVINGを適用する前の分類数を答えた値です。合計が25未満の分類は除外されます。'),
    wrong(total(grouped(rows).filter(members => sum(members) >= 25).map(members => members.length)), 'group-count-as-member-count', '条件に合う分類の数ではなく、その分類に属する元の行の数を足した値です。'),
    wrong(grouped(rows).some(members => sum(members) >= 25) ? total(grouped(rows).filter(members => sum(members) >= 25).map(members => sum(members))) : null, 'outer-count-as-group-total-sum', '外側のCOUNT(*)をSUM(total)と読み違え、条件に合う分類の金額をさらに合計した結果です。該当する分類がなければ、このSUMはNULLになります。'),
  ],
  self_join_pairs: rows => [
    wrong(pairCount(rows, (a, b) => a.group_id === b.group_id && a.id !== b.id), 'pair-directions-counted-twice', 'a.id < b.idをa.id != b.idと読み、同じ2行の組を逆順でも数えた値です。'),
    wrong(pairCount(rows, (a, b) => a.group_id === b.group_id && a.id <= b.id), 'self-pair-included', 'a.id < b.idに等号も含め、自分自身との組も数えた値です。'),
    wrong(pairCount(rows, (a, b) => a.group_id === b.group_id), 'join-order-constraint-ignored', '結合条件のidの大小を落とし、同じ分類のすべての組を数えた値です。'),
  ],
  left_join_missing: rows => [
    wrong(0, 'count-null-column-instead-of-star', 'COUNT(*)をCOUNT(b.id)と読み違えた値です。未一致行ではb.idがNULLですが、COUNT(*)はその行も数えます。'),
    wrong(rows.filter(a => rows.some(b => b.id === a.id + 1)).length, 'null-predicate-reversed', 'b.id IS NULLではなくIS NOT NULLとして、次の行が存在する行を数えた値です。'),
    wrong(rows.length, 'left-join-null-filter-ignored', 'LEFT JOIN後の全行を数え、b.id IS NULLによる未一致行の選別をしなかった値です。'),
  ],
  exists_group: rows => [
    wrong(active(rows).length, 'exists-as-outer-enabled-filter', '関連行の有無ではなく、外側の行自身のenabled = 1で絞った値です。'),
    wrong(pairCount(rows, (a, b) => a.group_id === b.group_id && b.enabled === 1), 'exists-as-join-multiplicity', 'EXISTSを通常のJOINと同じように扱い、一致する関連行の数だけ外側の行を重複して数えた値です。'),
    wrong(new Set(active(rows).map(row => row.group_id)).size, 'exists-count-as-group-count', '条件に合う外側の行数ではなく、有効な関連行がある分類の種類を数えた値です。'),
  ],
  not_exists_later: rows => [
    wrong(total(rows.filter(a => rows.some(b => a.group_id === b.group_id && b.id > a.id)).map(row => row.id)), 'not-exists-as-exists', 'NOT EXISTSのNOTを落とし、同じ分類に後続行がある行のidを合計した値です。'),
    wrong(rows.filter(a => !rows.some(b => a.group_id === b.group_id && b.id > a.id)).length, 'last-id-sum-as-count', '分類ごとの最後の行は選べていますが、idの合計ではなく選んだ行数を答えた値です。'),
    wrong(total(rows.map(row => row.id)), 'not-exists-filter-ignored', 'NOT EXISTSで最後の行を選別せず、全行のidを合計した値です。'),
  ],
  conditional_total: rows => [
    wrong(sum(rows), 'case-enabled-condition-ignored', 'CASEの条件を無視し、無効な行のamountもそのまま合計した値です。'),
    wrong(sum(rows.filter(row => row.enabled === 0)), 'case-enabled-condition-reversed', 'CASEの条件を逆にし、無効な行のamountを合計した値です。'),
    wrong(active(rows).length, 'case-amount-as-indicator', 'THEN amountをTHEN 1と読み、有効な行の件数を求めた値です。'),
  ],
  group_difference: rows => [
    wrong(sum(group(rows, 1)) - sum(group(rows, 2)), 'group-difference-reversed', 'CASEで付ける符号を逆にして、分類1の合計から分類2の合計を引いた値です。'),
    wrong(sum(rows), 'case-negative-else-as-positive', 'ELSE -amountの負号を落とし、両方の分類を正の金額として足した値です。'),
    wrong(sum(group(rows, 2)), 'case-negative-else-as-zero', 'ELSE -amountをELSE 0と読み違え、分類2だけを合計した値です。'),
  ],
  union_unique: rows => [
    wrong(active(rows).length + group(rows, 1).length, 'union-as-union-all', 'UNIONをUNION ALLと読み違え、両方の検索結果にあるidを重複して数えた値です。'),
    wrong(rows.filter(row => row.enabled === 1 && row.group_id === 1).length, 'union-as-intersection', 'どちらかに含まれる行ではなく、両方に含まれる行だけを数えた値です。'),
    wrong(active(rows).length, 'union-second-query-ignored', 'UNIONの前半だけを数え、分類1から追加されるidを考慮しなかった値です。'),
  ],
  union_all_events: rows => [
    wrong(rows.filter(row => row.enabled === 1 || row.group_id === 1).length, 'union-all-as-union', 'UNION ALLをUNIONと読み違え、両方に現れるidを一つにまとめた値です。'),
    wrong(active(rows).length, 'union-all-second-query-ignored', 'UNION ALLの前半の件数だけを答え、分類1の行を加えなかった値です。'),
    wrong(group(rows, 1).length, 'union-all-first-query-ignored', 'UNION ALLの後半の件数だけを答え、有効な行の検索結果を加えなかった値です。'),
  ],
  bounded_policy: rows => [
    wrong(Math.min(sum(rows), 15), 'cap-after-sum', '行ごとに15を上限にする代わりに、全額を合計してから一度だけ15で制限した値です。'),
    wrong(sum(rows), 'per-row-cap-ignored', 'CASEの上限処理を適用せず、元のamountを合計した値です。'),
    wrong(sum(rows.map(row => ({ ...row, amount: row.amount > 15 ? row.amount - 15 : row.amount }))), 'cap-as-excess-subtraction', '上限を超える行を15にする代わりに、amount - 15へ置き換えた値です。'),
  ],
  average_threshold: rows => [
    wrong(rows.filter(row => row.amount > sum(rows)).length, 'average-threshold-as-sum', '副問い合わせのAVGをSUMと読み違え、平均ではなく合計を基準に比べた件数です。'),
    wrong(rows.filter(row => row.amount < sum(rows) / rows.length).length, 'above-average-as-below', '比較の向きを逆にし、平均より小さい行を数えた値です。'),
    wrong(rows.length, 'average-comparison-ignored', '副問い合わせとの比較で絞り込まず、sampleの全行を数えた値です。'),
  ],
  unique_enabled_group: rows => [
    wrong(active(rows).length, 'distinct-group-projection-ignored', 'DISTINCT group_idで分類をまとめる前の、有効な行の数を答えた値です。'),
    wrong(total([...new Set(active(rows).map(row => row.group_id))]), 'distinct-key-count-as-sum', '有効な分類番号の重複は除けていますが、種類の数ではなく番号を合計した値です。'),
  ],
  aggregate_pipeline: rows => [
    wrong(sum(rows), 'outer-max-as-total-sum', '分類別の合計のうち最大のものを選ばず、全分類を合計した値です。'),
    wrong(high(rows), 'max-before-group-sum', '内側の分類別SUMを飛ばし、元の行のamountから最大値を取った値です。'),
    wrong(Math.min(...grouped(rows).map(sum)), 'outer-max-as-min', '分類別合計の最大値ではなく最小値を選んだ値です。'),
  ],
  all_members_enabled: rows => [
    wrong(grouped(rows).filter(members => Math.max(...members.map(row => row.enabled)) === 1).length, 'all-members-as-any-member', 'MIN(enabled)をMAX(enabled)と読み違え、1行でも有効なら分類を通した値です。'),
    wrong(active(rows).length, 'enabled-group-count-as-row-count', '全員有効な分類の数ではなく、有効な行そのものを数えた値です。'),
    wrong(grouped(rows).filter(members => Math.min(...members.map(row => row.enabled)) === 0).length, 'minimum-enabled-predicate-reversed', 'MIN(enabled) = 1を逆にし、無効な行を含む分類を数えた値です。'),
  ],
  weighted_average: rows => [
    wrong(Math.trunc(sum(rows) / rows.length), 'weighted-average-as-plain-average', 'idによる重みを使わず、amountの単純平均を整数化した値です。'),
    wrong(Math.trunc(total(rows.map(row => row.amount * row.id)) / rows.length), 'weighted-average-divided-by-row-count', '重み付きの合計を、SUM(id)ではなく行数で割った値です。'),
    wrong(total(rows.map(row => row.amount * row.id)), 'weighted-average-division-omitted', '分子のSUM(amount * id)だけを答え、SUM(id)で割らなかった値です。'),
  ],
  visible_objects: rows => [
    wrong(rows.filter(row => row.amount >= 10 || row.amount < 30).length, 'viewport-and-as-or', '下限と上限をANDではなくORで結び、どちらか一方だけで表示対象にした件数です。'),
    wrong(rows.filter(row => row.amount < 30).length, 'viewport-lower-bound-ignored', '右端だけを確認し、amount >= 10の下限を確認しなかった件数です。'),
    wrong(rows.filter(row => row.amount >= 10 && row.amount <= 30).length, 'viewport-right-bound-inclusive', '右端30も含めて数えた値です。条件はamount < 30です。'),
  ],
  layer_first: rows => [
    wrong(ordered(group(rows, 2))[0].id, 'layer-order-reversed', '分類2の中でDESCではなくASCに並べ、最小のamountの行を選んだ値です。'),
    wrong(ordered(group(rows, 2), true)[0].amount, 'layer-order-column-as-output', '先頭行のamountを答えた値です。並べ替えにはamountを使いますが、SELECTはidを返します。'),
  ],
  tile_buckets: rows => [
    wrong(rows.length, 'tile-distinct-ignored', 'DISTINCTを適用せず、同じタイル列にある行も別々に数えた値です。'),
    wrong(total(rows.map(row => Math.trunc(row.amount / 8))), 'tile-count-as-column-sum', 'タイル列の種類を数える代わりに、各行のタイル列番号を合計した値です。'),
    wrong(new Set(rows.map(row => row.amount)).size, 'bucket-division-ignored', '8で割ってタイル列へ変換する前に、元のamountの種類を数えた値です。'),
  ],
  draw_rank: rows => [
    wrong(ordered(rows).findIndex(row => row.id === 2), 'row-number-zero-based', 'ROW_NUMBERの先頭を0として数えた値です。ROW_NUMBERは1から始まります。'),
    wrong(ordered(rows, true).findIndex(row => row.id === 2) + 1, 'row-number-order-reversed', 'ORDER BY amountを降順として順位を付けた値です。指定がない場合は昇順です。'),
    wrong(1, 'filter-before-row-number', 'WHERE id = 2をウィンドウ計算前に適用し、1行だけの順位を付けた値です。外側のWHEREは順位を付けた後に評価されます。'),
  ],
  running_position: rows => [
    wrong(sum(rows.filter(row => row.id < 3)), 'running-current-row-excluded', '累積に現在行を含めず、id = 3の直前で合計を止めた値です。'),
    wrong(sum(rows), 'running-frame-includes-following', 'UNBOUNDED PRECEDINGの累積を全表合計と読み違え、後続行も含めた値です。'),
    wrong(rows.find(row => row.id === 3).amount, 'filter-before-running-sum', '外側のWHERE id = 3を先に適用し、その1行だけでウィンドウのSUMを計算した値です。'),
  ],
  neighbor_gap: rows => [
    wrong(rows[1].amount - rows[2].amount, 'lag-subtraction-reversed', 'amount - LAG(amount)の引き算を逆にした値です。'),
    wrong(rows[2].amount - rows[3].amount, 'lag-as-lead-in-gap', 'LAGをLEADと読み違え、現在のamountから次の行のamountを引いた値です。'),
    wrong(rows[1].amount, 'lag-value-without-subtraction', 'LAGが取り出す直前のamountだけを答え、現在のamountから引かなかった値です。'),
    wrong(rows[2].amount - rows[0].amount, 'lag-default-offset-as-two', 'LAGの既定の移動量を2行と読み違えた値です。省略時は1行前です。'),
  ],
  next_position: rows => [
    wrong(rows[0].amount, 'lead-as-lag', 'LEADをLAGと読み違え、id = 2の次ではなく前のamountを答えた値です。'),
    wrong(rows[1].amount, 'lead-offset-as-zero', 'LEADの移動量を0として、現在行のamountを答えた値です。省略時は1行後です。'),
    wrong(rows[3].amount, 'lead-default-offset-as-two', 'LEADの既定の移動量を2行と読み違え、id = 4のamountを答えた値です。'),
    wrong(null, 'filter-before-lead', '外側のWHERE id = 2を先に適用し、1行しかない範囲でLEADを求めた結果です。ウィンドウの計算時点では次の行も残っています。'),
  ],
  layer_sum: rows => [
    wrong(sum(rows), 'window-partition-ignored', 'PARTITION BY group_idを適用せず、全行のamountを合計した値です。'),
    wrong(rows[0].amount, 'filter-before-partition-sum', '外側のWHERE id = 1を先に適用し、1行だけで分類内のSUMを計算した値です。'),
    wrong(group(rows, rows[0].group_id).length, 'partition-sum-as-count', '分類内のamountを合計せず、分類に属する行数を数えた値です。'),
  ],
  overlap_pairs: rows => [
    wrong(pairCount(rows, (a, b) => a.id !== b.id && Math.abs(a.amount - b.amount) < 10), 'nearby-pair-directions-counted-twice', 'a.id < b.idをa.id != b.idに読み替え、近い2行の組を逆順でも数えた値です。'),
    wrong(pairCount(rows, (a, b) => a.id <= b.id && Math.abs(a.amount - b.amount) < 10), 'nearby-self-pairs-included', 'idの比較に等号を含め、各行と自分自身の組も数えた値です。'),
    wrong(pairCount(rows, (a, b) => a.id < b.id), 'distance-filter-ignored', 'ABSによる距離条件を適用せず、idの大小を満たす組をすべて数えた値です。'),
    wrong(pairCount(rows, (a, b) => a.id < b.id && a.amount - b.amount < 10), 'absolute-distance-ignored', 'ABSを省き、符号付きの差が10未満かだけで判定した値です。'),
  ],
  screen_transform: rows => [
    wrong((rows[0].amount + 8) * 2, 'margin-before-scale', '余白8を足してから全体を2倍した値です。式はamountだけを2倍してから8を足します。'),
    wrong(rows[0].amount * 2, 'screen-margin-omitted', '2倍した位置だけを答え、最後の余白8を加えなかった値です。'),
  ],
  clamp_positions: rows => [
    wrong(Math.min(sum(active(rows)), 25), 'position-cap-after-aggregate', '各行を25で制限する代わりに、有効行をすべて足してから一度だけ25で制限した値です。'),
    wrong(sum(active(rows)), 'position-cap-ignored', 'CASEの上限処理をせず、有効行の元のamountを合計した値です。'),
    wrong(total(rows.map(row => Math.min(row.amount, 25))), 'position-enabled-filter-ignored', 'enabled = 1で絞らず、無効な行も上限処理したうえで合計した値です。'),
  ],
  empty_layer: rows => [
    wrong(rows.length, 'empty-layer-filter-ignored', 'group_id = 3の条件を適用せず、全行を数えた値です。'),
    wrong(null, 'empty-count-as-null-aggregate', '一致する行がないとCOUNTもNULLになると考えた結果です。SUMなどと異なりCOUNTは0を返します。'),
    wrong(1, 'aggregate-output-row-count', 'COUNTの入力行ではなく、集計結果が返す1行を数えた値です。結果の行数とCOUNTの値は別です。'),
  ],
  layer_minimum: rows => [
    wrong(Math.min(...grouped(rows).map(low)), 'outer-maximum-as-minimum', '分類別の最小値を求めた後、外側でもMINを使った値です。外側はMAXです。'),
    wrong(Math.max(...grouped(rows).map(high)), 'inner-minimum-as-maximum', '内側のMINをMAXと読み、分類別の最大値からさらに最大値を選んだ値です。'),
    wrong(total(grouped(rows).map(low)), 'outer-max-as-edge-sum', '分類別の左端のうち最大を選ぶ代わりに、左端をすべて合計した値です。'),
  ],
  frame_wrap: rows => [
    wrong(sum(rows) % 4, 'remainder-after-sum', '各行で余りを求めてから足す代わりに、全金額を合計した後で一度だけ余りを求めた値です。'),
    wrong(total(rows.map(row => Math.trunc(row.amount / 4))), 'remainder-as-quotient', '%を整数の割り算と読み違え、各行の商を合計した値です。'),
    wrong(sum(rows), 'frame-remainder-ignored', '各行を4で循環させず、元のamountを合計した値です。'),
  ],
  bounding_width: rows => [
    wrong(high(rows) - low(rows), 'bounds-enabled-filter-ignored', '無効な物体も含め、sample全体の最大位置と最小位置の差を求めた値です。'),
    wrong(low(active(rows)) - high(active(rows)), 'bounds-subtraction-reversed', '引き算を逆にして、有効な物体の最小位置から最大位置を引いた値です。'),
    wrong(high(active(rows)), 'bounds-minimum-not-subtracted', '有効な物体の最大位置だけを答え、最小位置を引かなかった値です。'),
  ],
  stable_layer_order: rows => [
    wrong(ordered(group(rows, 2), true).findIndex(row => row.id === 4), 'partition-row-number-zero-based', '分類内のROW_NUMBERを0から始めた値です。ROW_NUMBERは分類ごとに1から始まります。'),
    wrong(ordered(group(rows, 2)).findIndex(row => row.id === 4) + 1, 'partition-order-reversed', '分類内のamountをDESCではなくASCで並べた場合の順位です。'),
    wrong(rows.find(row => row.id === 4).id, 'row-id-as-rank', '順位ではなく、選ばれた行自身のidを答えた値です。'),
  ],
  ready_jobs: rows => [
    wrong(rows.filter(row => row.enabled === 1 || row.amount < 20).length, 'ready-and-as-or', 'ANDをORと読み違え、有効または低コストの片方だけを満たす行も数えた値です。'),
    wrong(active(rows).length, 'ready-cost-limit-ignored', '有効フラグだけを確認し、amount < 20のコスト制限を適用しなかった件数です。'),
    wrong(rows.filter(row => row.amount < 20).length, 'ready-enabled-filter-ignored', 'コストだけを確認し、無効な仕事も数えた値です。'),
    wrong(sum(rows.filter(row => row.enabled === 1 && row.amount < 20)), 'ready-count-as-cost-sum', '条件に合う仕事の数ではなく、その仕事のamountを合計した値です。'),
  ],
  first_job: rows => [
    wrong(ordered(active(rows), true)[0].id, 'cheapest-order-reversed', '有効な仕事を降順に並べ、最も高いコストの仕事を選んだ値です。'),
    wrong(ordered(rows)[0].id, 'cheapest-enabled-filter-ignored', 'enabled = 1を適用せず、無効な仕事も候補に入れて最安の行を選んだ値です。'),
    wrong(ordered(active(rows))[0].amount, 'cheapest-cost-as-id', '最安の有効な仕事のamountを答えた値です。SELECTが返すのはidです。'),
  ],
  top_two_cost: rows => [
    wrong(sum(rows), 'limit-after-aggregate', '先頭2行を選ぶ前に全行をSUMした値です。LIMITは内側の問い合わせで適用されます。'),
    wrong(sum(ordered(rows, true).slice(0, 2)), 'two-cheapest-as-two-costliest', '昇順を降順と読み違え、高い方から2行のコストを足した値です。'),
    wrong(ordered(rows)[0].amount, 'limit-two-as-one', 'LIMIT 2をLIMIT 1と読み、最安の1行分だけを答えた値です。'),
    wrong(sum(rows.slice(0, 2)), 'limit-before-cost-order', 'コストで並べ替える前にVALUESの先頭2行を取り出して足した値です。'),
  ],
  recursive_counter: () => [
    wrong(total([1, 2, 3, 4]), 'recursive-result-bound-exclusive', 'WHERE n < 5を生成後のnにも適用すると考え、5を結果から外した値です。条件は次の行を生成する前のnに適用されます。'),
    wrong(total([1, 2, 3, 4, 5, 6]), 'recursive-parent-bound-inclusive', '再帰部のn < 5をn <= 5と読み、6まで生成した場合の合計です。'),
    wrong([1, 2, 3, 4, 5].length, 'recursive-sum-as-count', '生成したnの合計ではなく、生成行の件数を数えた値です。'),
  ],
  deduplicate_queue: rows => [
    wrong(total(rows.map(row => row.group_id)), 'group-key-distinct-ignored', 'DISTINCTを適用せず、各行のgroup_idをそのまま合計した値です。'),
    wrong(keys(rows).length, 'distinct-key-sum-as-count', '分類番号を合計する代わりに、分類の種類を数えた値です。外側はSUM(group_id)です。'),
  ],
  window_budget: rows => [
    wrong(rows.filter(row => row.amount <= 40).length, 'running-budget-as-per-row-budget', '累積コストではなく、各行のamountだけを40と比べた件数です。'),
    wrong(sum(rows) <= 40 ? rows.length : 0, 'running-window-order-ignored', 'ウィンドウのORDER BYとROWS UNBOUNDED PRECEDINGを読み落とし、SUM(amount) OVER ()として全表の合計を各行のrunningに使った件数です。'),
    wrong(rows.length, 'running-budget-filter-ignored', '累積コストの条件を適用せず、ウィンドウ計算後の全行を数えた値です。'),
  ],
  keyset_page: rows => [
    wrong(Math.min(...rows.filter(row => row.id >= 2).map(row => row.id)), 'keyset-bound-inclusive', 'id > 2に等号も含め、id = 2を次のページに残した値です。'),
    wrong(Math.max(...rows.filter(row => row.id > 2).map(row => row.id)), 'keyset-min-as-max', 'id > 2の中から最小ではなく最大のidを返した値です。'),
    wrong(Math.min(...rows.map(row => row.id)), 'keyset-filter-ignored', 'id > 2を適用せず、全体の最小idを返した値です。'),
  ],
  group_load: rows => [
    wrong(Math.max(...grouped(rows).map(sum)), 'load-minimum-not-subtracted', '最も大きい分類負荷だけを答え、最小の分類負荷を引かなかった値です。'),
    wrong(high(rows) - low(rows), 'load-spread-before-grouping', '分類別のSUMを計算せず、元のamount列の最大値と最小値を比較した値です。'),
    wrong(sum(rows), 'load-difference-as-total-sum', '分類負荷の差ではなく、すべての分類の負荷を足した値です。'),
  ],
  duplicate_members: rows => [
    wrong(total(grouped(rows).filter(members => members.length > 1).map(members => members.length)), 'duplicate-group-count-as-member-count', '複数行を持つ分類の数ではなく、その分類に属する元の行を数えた値です。'),
    wrong(total(grouped(rows).filter(members => members.length > 1).map(members => members[0].group_id)), 'duplicate-group-count-as-key-sum', '条件に合う分類の件数ではなく、分類番号を合計した値です。'),
    wrong([...new Set(rows.map(row => row.id))].filter(id => rows.filter(row => row.id === id).length > 1).length, 'duplicate-grouping-by-unique-id', 'GROUP BY group_idをGROUP BY idと読み違えた値です。idは重複しないため、複数行を持つ分類ができません。'),
  ],
  null_safe_count: rows => [
    wrong(null, 'empty-count-as-sum-null', '空の集計をSUMやMAXと同じNULLとして扱った結果です。COUNT(amount)は対象となる非NULL値がなければ0を返します。'),
    wrong(rows.length, 'empty-count-filter-ignored', 'amount < 0で絞る前に、amountが非NULLの全行を数えた値です。'),
    wrong(1, 'empty-aggregate-output-count', 'COUNTの対象となる値ではなく、集計結果として返される1行を数えた値です。'),
  ],
  partition_average: rows => [
    wrong(sum(group(rows, rows.find(row => row.id === 4).group_id)) / group(rows, rows.find(row => row.id === 4).group_id).length, 'partition-average-cast-ignored', '分類内のAVGを計算した後、INTEGERへのCASTを読み落として小数付きの平均をそのまま答えた値です。'),
    wrong(Math.trunc(sum(rows) / rows.length), 'average-partition-ignored', 'PARTITION BY group_idを落とし、全行のamountの平均を整数化した値です。'),
    wrong(rows.find(row => row.id === 4).amount, 'filter-before-window-average', '外側のWHERE id = 4を先に適用し、その1行だけで平均を計算した値です。'),
    wrong(sum(group(rows, rows.find(row => row.id === 4).group_id)), 'partition-average-as-sum', '分類内のAVGをSUMと読み違え、割る前の合計を答えた値です。'),
  ],
  enabled_ratio: rows => [
    wrong(Math.trunc(active(rows).length / rows.length) * 100, 'integer-divide-before-percentage-scale', '100を掛ける前に整数の割り算を行い、小数部分を失った値です。元の式は先に100を掛けます。'),
    wrong(total(rows.map(row => row.enabled)), 'percentage-scale-and-division-omitted', '分子のSUM(enabled)だけを答えた値です。有効行の件数と百分率は別です。'),
    wrong(Math.trunc(rows.filter(row => row.enabled === 0).length * 100 / rows.length), 'enabled-ratio-as-disabled-ratio', '有効な行ではなく無効な行の百分率を求めた値です。'),
    wrong(Math.trunc(rows.filter(row => row.enabled !== null).length * 100 / rows.length), 'enabled-sum-as-count-column', 'SUM(enabled)をCOUNT(enabled)と読み違えた値です。COUNTは0の値も非NULLなら数えます。'),
  ],
  successor_links: rows => [
    wrong(rows.length, 'inner-successor-join-as-left-join', '内部結合をLEFT JOINと読み、次のidがない最後の行も数えた値です。'),
    wrong(pairCount(rows, (a, b) => b.id > a.id), 'immediate-successor-as-any-later-row', 'b.id = a.id + 1を単にb.id > a.idと読み、直後以外の後続行との組も数えた値です。'),
    wrong(pairCount(rows, (a, b) => b.id === a.id), 'successor-increment-ignored', '+ 1を落とし、同じid同士の組を数えた値です。'),
  ],
  running_maximum: rows => [
    wrong(high(rows), 'running-maximum-includes-future', '現在行より後の行も含め、全表の最大amountを答えた値です。'),
    wrong(rows.find(row => row.id === 3).amount, 'filter-before-running-maximum', '外側のWHERE id = 3を先に適用し、現在行だけでMAXを計算した値です。'),
    wrong(sum(rows.filter(row => row.id <= 3)), 'running-max-as-sum', '現在行までの最大値ではなく、現在行までのamountの合計を答えた値です。'),
  ],
  bounded_rows: rows => [
    wrong(Math.max(...active(rows).map(row => row.id)) - Math.min(...active(rows).map(row => row.id)) + 1, 'key-distance-as-inclusive-count', 'idの差ではなく、両端を含む連番の個数として数えた値です。式には件数用の+ 1がありません。'),
    wrong(Math.min(...active(rows).map(row => row.id)) - Math.max(...active(rows).map(row => row.id)), 'active-key-subtraction-reversed', '引き算を逆にし、有効な最小idから最大idを引いた値です。'),
    wrong(Math.max(...rows.map(row => row.id)) - Math.min(...rows.map(row => row.id)), 'active-key-filter-ignored', 'enabled = 1で絞らず、全行のidの範囲を求めた値です。'),
  ],
  ranked_choice: rows => [
    wrong(ordered(rows, true)[0].id, 'rank-winner-partition-ignored', 'PARTITION BYを落とし、全体で1位の行だけを選んでidを合計した値です。'),
    wrong(total(grouped(rows).map(members => ordered(members, true)[0].amount)), 'ranked-amount-instead-of-id', '分類別1位の行は選べていますが、idではなくamountを合計した値です。'),
    wrong(grouped(rows).length, 'winner-rank-instead-of-id', '各分類で選ばれた行のidではなく、すべて1であるrankを合計した値です。'),
    wrong(total(grouped(rows).map(members => ordered(members)[0].id)), 'winner-order-reversed', '分類内の降順を昇順として、最小のamountを持つ行のidを合計した値です。'),
  ],
};

/** SQL reading choices. Sample rows are supplied by the curriculum owner. */
export function sqlReadingDistractors(lesson, variant, rows) {
  if (lesson?.language !== 'sql' || !Object.hasOwn(distractors, lesson.topicId) || !Array.isArray(rows) || !rows.length) return null;
  return distractors[lesson.topicId](rows).filter(candidate => candidate.value === null || (Number.isFinite(candidate.value) && Math.abs(candidate.value) <= Number.MAX_SAFE_INTEGER));
}
