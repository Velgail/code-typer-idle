// Original executable contracts and geometry challenges. These exercises grade
// observable state transitions, not the quality of a class diagram or a pattern.
const example=(args,expected,explanation)=>({args,expected,explanation});
const contractAssessment={
 kind:'state-contract',
 criteria:['成功時と失敗時の状態遷移','境界条件と繰り返し要求の扱い'],
 limitations:['クラス構成や設計パターンの採用、変更しやすさそのものは採点しません。']
};

// Developer classification notes; the player-facing statement stays separate.
// The time values are reward pacing targets, not measured solve-time claims.
const difficultyRationales={
 'atomic-transfer-batch':{
  classification:'direct-state-contract',requiredSkills:['入力順の状態更新','変更前の状態の保持'],
  reasoning:['各送金の残高を検査する','失敗時は途中の更新を捨て、成功時だけ結果を確定する'],
  constraintRole:'最大100送金を順に処理できる。並行実行・永続化・複数トランザクションの衝突は出題せず、短い状態契約の直接実装として扱う。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 },
 'idempotent-stock-requests':{
  classification:'direct-state-contract',requiredSkills:['IDによる検索','結果の記録と再利用'],
  reasoning:['初回の成功・失敗をどちらも記録する','同じIDには保存済みの結果を返し、在庫を再更新しない'],
  constraintRole:'要求は入力順で最大100件。再送だけを扱い、同時到着や部分失敗の調停はない。小さい配列による検索でも処理できる。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 },
 'optimistic-versioned-save':{
  classification:'direct-state-contract',requiredSkills:['条件分岐','値と版番号の状態更新'],
  reasoning:['要求された版と現在の版を比較する','一致した場合だけ保存値と版番号を更新する'],
  constraintRole:'一つの保存領域に最大100命令を順に適用する。実際の並行処理や競合解消は扱わず、明示された比較と更新を実装する。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 },
 'retry-deadline-policy':{
  classification:'bounded-simulation',requiredSkills:['整数時刻によるシミュレーション','複数の停止条件'],
  reasoning:['試行回数・結果列・期限の各条件を一緒に管理する','成功時は終了し、失敗時だけ上限付きの待ち時間を更新する'],
  constraintRole:'最大100試行の仕様をそのままシミュレーションできる。実時間の待機、乱数、非同期競合を扱う設計問題ではない。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 },
 'largest-histogram-rectangle':{
  classification:'standard-pattern',requiredSkills:['連続区間の範囲','区間最小値と面積の関係'],
  reasoning:['連続区間の幅と最小の高さで候補面積を表す','候補区間を取りこぼさず最大値を求める'],
  constraintRole:'単調スタックは参考実装の一つで、区間を順に比較する別解も許容する。柱の高さと幅だけの標準問題で、描画順や複数資源の制約はない。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 },
 'rectangle-union-area':{
  classification:'standard-pattern',requiredSkills:['境界座標による領域の分割','重複した領域の集計'],
  reasoning:['矩形の辺を境界として覆われ方の一定な領域を考える','重複を一度だけ数え、幅や高さが0の領域を除く'],
  constraintRole:'最大24枚の固定された矩形だけを扱い、境界で分割した領域を調べられる。動的更新・回転・不確かな座標を合成する問題ではない。',
  timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'
 }
};

function transferOracle([balances,transfers]) {
 const result=[...balances];
 for(let i=0;i<transfers.length;i+=3){
  const [from,to,amount]=transfers.slice(i,i+3);
  if(result[from]<amount)return [0,...balances];
  result[from]-=amount;result[to]+=amount;
 }
 return [1,...result];
}
function stockOracle([stock,requests]) {
 const receipts=new Map(),outcomes=[];
 for(let i=0;i<requests.length;i+=2){
  const id=requests[i],quantity=requests[i+1];
  if(!receipts.has(id)){
   const accepted=quantity<=stock?1:0;
   if(accepted)stock-=quantity;
   receipts.set(id,accepted);
  }
  outcomes.push(receipts.get(id));
 }
 return [stock,...outcomes];
}
function saveOracle([initialValue,initialVersion,commands]) {
 return commands.reduce((state,value,index)=>{
  if(index%2)return state;
  const accepted=value===state[1]?1:0;
  return [accepted?commands[index+1]:state[0],state[1]+accepted,...state.slice(2),accepted];
 },[initialValue,initialVersion]);
}
function retryOracle([outcomes,initialDelay,maxDelay,deadline,maxAttempts]) {
 const schedule=[];
 let elapsed=0;
 for(let i=0;i<Math.min(outcomes.length,maxAttempts);i++){
  if(elapsed>deadline)break;
  schedule.push(elapsed);
  elapsed+=Math.min(maxDelay,initialDelay*2**Math.min(i,30));
 }
 const win=outcomes.slice(0,schedule.length).indexOf(1);
 const count=win<0?schedule.length:win+1;
 return [win<0?0:1,count,count?schedule[count-1]:-1];
}
// Deliberately use a quadratic oracle rather than the reference monotonic stack.
function histogramOracle([heights]) {
 let best=0;
 for(let left=0;left<heights.length;left++){
  let height=10000;
  for(let right=left;right<heights.length;right++){
   height=Math.min(height,heights[right]);best=Math.max(best,height*(right-left+1));
  }
 }
 return best;
}
// Independent x sweep: merge y intervals instead of checking compressed cells.
function unionOracle([rectangles]) {
 const rects=[];
 for(let i=0;i<rectangles.length;i+=4)rects.push(rectangles.slice(i,i+4));
 const xs=[...new Set(rects.flatMap(r=>[r[0],r[2]]))].sort((a,b)=>a-b);
 let total=0;
 for(let i=1;i<xs.length;i++){
  const segments=rects.filter(r=>r[0]<xs[i]&&r[2]>xs[i-1]&&r[1]<r[3]).map(r=>[r[1],r[3]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let length=0,from=0,to=0;
  for(const [low,high] of segments){
   if(low>to){length+=to-from;from=low;to=high;}else to=Math.max(to,high);
  }
  total+=(length+to-from)*(xs[i]-xs[i-1]);
 }
 return total;
}
export const CONTRACT_CHALLENGE_ORACLES=Object.freeze({
 'atomic-transfer-batch':transferOracle,
 'idempotent-stock-requests':stockOracle,
 'optimistic-versioned-save':saveOracle,
 'retry-deadline-policy':retryOracle,
 'largest-histogram-rectangle':histogramOracle,
 'rectangle-union-area':unionOracle
});

export function registerContractChallenges(D,ir) {
 const {V,S,A,P,O,C,F,W,R,B,add,sub,mul,div,eq,ne,lt,le,gt,ge,and,or,at,len,filled,copy,min,max}=ir;
 const receipt=(flag,array)=>{
  const name=flag?'committedReceipt':'failedReceipt',index=flag?'committedIndex':'failedIndex';
  return [V(name,'array',filled(0)),P(name,flag),F(index,0,len(array),[P(name,at(array,index))]),R(name)];
 };
 const transferCases=[
  [[],[]],[[10],[]],[[10],[0,0,10]],[[10],[0,0,11]],[[10,0],[0,1,4]],[[10,0],[0,1,10]],
  [[10,0],[0,1,11]],[[10,0,0],[0,1,4,1,2,4]],[[10,0,0],[0,1,4,1,2,5]],
  [[7,2],[0,1,3,1,0,4]],[[0,0],[0,1,0,1,0,0]],[[5,1],[0,1,2,0,1,4]],
  [Array.from({length:32},(_,i)=>i===0?1000000:0),Array.from({length:31},(_,i)=>[i,i+1,1000000]).flat()]
 ];
 D('design','atomic-transfer-batch','送金バッチを全部まとめて確定','トランザクションの原子性',2,
  [['balances','array'],['transfers','array']],'array',[
   V('working','array',copy('balances')),
   F('operation',0,div(len('transfers'),3),[
    V('sourceAccount','int',at('transfers',mul('operation',3))),V('targetAccount','int',at('transfers',add(mul('operation',3),1))),V('amount','int',at('transfers',add(mul('operation',3),2))),
    C(lt(at('working','sourceAccount'),'amount'),receipt(0,'balances')),
    A('working','sourceAccount',sub(at('working','sourceAccount'),'amount')),A('working','targetAccount',add(at('working','targetAccount'),'amount'))
   ]),...receipt(1,'working')
  ],transferCases,
  '複数口座の送金を入力順に試す。transfersは[送金元,送金先,金額]の繰り返し。各送金では送金元の現在残高が金額以上か確認してから、引いて加える。同じ口座への送金でもこの確認を行う。一度でも残高不足ならバッチ全体を取り消し、[0,元の残高列...]を返す。全件成功なら[1,確定後の残高列...]。空バッチは成功。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['atomic-transfer-batch'],constraints:['balancesは0〜32口座。transfersは0〜100件で、長さは3の倍数です。','口座番号はbalances内の有効な添字です。口座が0個なら送金も0件です。','入力時の各残高と送金額は0以上1,000,000以下。残高の総和は32,000,000以下です。'],
   parameterDescriptions:{balances:'処理前の各口座の残高。',transfers:'送金元の添字、送金先の添字、金額を3個ずつ並べた操作列。'},
   examples:[example([[10,0,0],[0,1,4,1,2,4]],[1,6,0,4],'途中で受け取った残高を次の送金に使えます。'),example([[10,0,0],[0,1,4,1,2,5]],[0,10,0,0],'後の送金が失敗するため、先の送金も取り消します。')],oracle:transferOracle,assessment:contractAssessment});

 const stockCases=[
  [0,[]],[10,[]],[10,[1,4]],[10,[1,10]],[10,[1,11]],[10,[1,4,1,4]],
  [10,[1,4,1,9]],[10,[1,11,1,1]],[10,[1,6,2,6,2,1,1,100]],
  [0,[0,0,0,1]],[10,[0,0,1,10,2,0,3,1]],[1000000,[10000,10000,10000,0,9999,10000]],
  [1000,Array.from({length:100},(_,i)=>[i%23,7+(i%11)]).flat()]
 ];
 D('design','idempotent-stock-requests','再送された注文を二重処理しない','要求IDと処理結果の再利用',2,
  [['stock','int'],['requests','array']],'array',[
   V('seenIds','array',filled(0)),V('decisions','array',filled(0)),V('receipt','array',filled(1)),
   F('operation',0,div(len('requests'),2),[
    V('requestId','int',at('requests',mul('operation',2))),V('quantity','int',at('requests',add(mul('operation',2),1))),V('found','int',-1),
    F('seenIndex',0,len('seenIds'),[C(eq(at('seenIds','seenIndex'),'requestId'),[S('found','seenIndex'),B])]),V('accepted','int',0),
    C(ge('found',0),[S('accepted',at('decisions','found'))],[
     C(le('quantity','stock'),[S('accepted',1),S('stock',sub('stock','quantity'))]),P('seenIds','requestId'),P('decisions','accepted')
    ]),P('receipt','accepted')
   ]),A('receipt',0,'stock'),R('receipt')
  ],stockCases,
  'requestsは[要求ID,注文個数]の繰り返し。初登場のIDでは在庫が個数以上なら受理して在庫を減らし1、不足なら在庫を変えず0を記録する。同じIDの再送は、個数が違っても最初に記録した1または0を返し、在庫を減らさない。失敗も記録する。戻り値は[最終在庫,各要求の結果...]。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['idempotent-stock-requests'],constraints:['stockは0以上1,000,000以下。requestsは0〜100件で、長さは2の倍数です。','要求IDと注文個数は0以上10,000以下。個数0の注文も受理できる要求です。'],
   parameterDescriptions:{stock:'最初に利用できる在庫数。',requests:'要求IDと注文個数を2個ずつ並べた再送を含む要求列。'},
   examples:[example([10,[1,4,1,9]],[6,1,1],'同じIDの再送なので、9個分を追加で引きません。'),example([10,[1,11,1,1]],[10,0,0],'最初の失敗結果も再利用し、再送を新しい注文にしません。')],oracle:stockOracle,assessment:contractAssessment});

 const saveCases=[
  [0,0,[]],[10,3,[]],[10,3,[3,20]],[10,3,[2,20]],[10,3,[4,20]],
  [10,3,[3,20,3,99]],[10,3,[3,20,4,-5]],[10,3,[2,20,3,-5]],
  [7,0,[0,7,0,8,1,9]],[0,0,[0,-1000000,1,1000000]],[-9,1000000,[1000000,1,1000001,2]],
  [5,10,Array.from({length:100},(_,i)=>[10+i,100-i]).flat()],
  [5,10,Array.from({length:100},(_,i)=>[10,100-i]).flat()]
 ];
 D('design','optimistic-versioned-save','古い版の保存で上書きしない','楽観的排他と失敗時の状態維持',2,
  [['initial_value','int'],['initial_version','int'],['commands','array']],'array',[
   V('currentValue','int','initial_value'),V('currentVersion','int','initial_version'),V('receipt','array',filled(2)),
   F('operation',0,div(len('commands'),2),[
    V('expectedVersion','int',at('commands',mul('operation',2))),V('newValue','int',at('commands',add(mul('operation',2),1))),V('accepted','int',0),
    C(eq('expectedVersion','currentVersion'),[S('currentValue','newValue'),S('currentVersion',add('currentVersion',1)),S('accepted',1)]),P('receipt','accepted')
   ]),A('receipt',0,'currentValue'),A('receipt',1,'currentVersion'),R('receipt')
  ],saveCases,
  'commandsは[期待する版番号,保存する値]の繰り返し。期待する版番号が現在の版番号と一致する場合だけ値を保存して版番号を1増やし、成功1を記録する。不一致なら値も版番号も変えず失敗0。値が同じでも成功すれば版番号を増やす。戻り値は[最終値,最終版番号,各保存の結果...]。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['optimistic-versioned-save'],constraints:['commandsは0〜100件で、長さは2の倍数です。','初期値と保存値は−1,000,000以上1,000,000以下。初期版番号は0以上1,000,000以下、期待する版番号は0以上1,000,100以下です。'],
   parameterDescriptions:{initial_value:'保存領域が最初に保持する整数値。',initial_version:'処理前の版番号。',commands:'期待する版番号と保存値を2個ずつ並べた命令列。'},
   examples:[example([10,3,[3,20,3,99]],[20,4,1,0],'最初の保存で版が4になるため、版3の再送は失敗します。'),example([7,0,[0,7,0,8,1,9]],[9,2,1,0,1],'同じ値7の保存でも版を増やします。')],oracle:saveOracle,assessment:contractAssessment});

 const retryCases=[
  [[],1,4,10,5],[[1],1,4,0,0],[[1],1,4,0,1],[[0,1],1,4,0,2],[[0,1],1,4,1,2],
  [[0,0,1],2,8,6,3],[[0,0,1],2,8,5,3],[[0,0,0,1],2,4,10,4],[[0,0,0,1],2,4,9,4],
  [[0,0,1,1],3,3,30,2],[[1,0,0],4,8,100,3],[[0,0,0],1,10000,1000000,100],
  [Array(100).fill(0),10000,10000,1000000,100],[[0,0,0,0,1],1,4,11,5]
 ];
 D('design','retry-deadline-policy','期限と上限を守って再試行する','時計を入力にした再試行契約',3,
  [['outcomes','array'],['initial_delay','int'],['max_delay','int'],['deadline','int'],['max_attempts','int']],'array',[
   V('attempts','int',0),V('lastTime','int',-1),V('currentTime','int',0),V('delay','int','initial_delay'),V('succeeded','int',0),
   W(and(lt('attempts',len('outcomes')),lt('attempts','max_attempts')),[
    C(gt('currentTime','deadline'),[B]),S('lastTime','currentTime'),V('outcome','int',at('outcomes','attempts')),S('attempts',add('attempts',1)),
    C(eq('outcome',1),[S('succeeded',1),B]),S('currentTime',add('currentTime','delay')),S('delay',min(mul('delay',2),'max_delay'))
   ]),V('receipt','array',filled(0)),P('receipt','succeeded'),P('receipt','attempts'),P('receipt','lastTime'),R('receipt')
  ],retryCases,
  '最初の試行時刻は0。outcomesの0は失敗、1は成功で、実際に試行した順に1個ずつ消費する。失敗後はinitial_delayだけ待ち、次の待ち時間は2倍にするがmax_delayで頭打ちにする。成功したら直ちに終了。試行開始時刻がdeadlineと等しければ実行でき、それを超えた試行はしない。max_attempts回、またはoutcomesを使い切っても終了する。戻り値は[成功なら1,実行回数,最後の試行時刻]。一度も試さない場合の時刻は−1。実時間を待たず、整数時刻で計算する。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['retry-deadline-policy'],constraints:['outcomesの長さとmax_attemptsは0以上100以下。outcomesの各値は0または1です。','1≦initial_delay≦max_delay≦10,000、0≦deadline≦1,000,000。時刻の途中計算は1,000,000以下です。'],
   parameterDescriptions:{outcomes:'試行ごとに得る結果を並べた列。0は失敗、1は成功。',initial_delay:'最初の失敗の後に待つ時間。',max_delay:'1回の待ち時間の上限。',deadline:'試行を開始してよい最後の時刻。',max_attempts:'試行する回数の上限。0なら最初の試行も行いません。'},
   examples:[example([[0,0,1],2,8,6,3],[1,3,6],'時刻0、2、6に試します。期限6ちょうどの成功を受理します。'),example([[0,0,1],2,8,5,3],[0,2,2],'次の時刻6は期限5を超えるため試しません。')],oracle:retryOracle,assessment:contractAssessment});

 const histogramCases=[
  [[]],[[0]],[[9]],[[2,1,5,6,2,3]],[[3,3,3,3]],[[1,2,3,4,5]],[[5,4,3,2,1]],
  [[0,4,0,4,0]],[[2,2,1,2,2]],[[10000,1,10000]],
  [Array(4096).fill(1)],[Array.from({length:384},(_,i)=>i+1)],[Array.from({length:384},(_,i)=>384-i)],
  [Array.from({length:256},(_,i)=>(i*7919+i*i*13)%10001)],
  [[...Array(128).fill(9999),0,...Array(128).fill(9999)]]
 ];
 D('graphics','largest-histogram-rectangle','連続した柱に収まる最大面積','単調スタックと区間の確定',3,
  [['heights','array']],'int',[
   V('stack','array',filled(0)),V('best','int',0),
   F('position',0,add(len('heights'),1),[
    V('currentHeight','int',0),C(lt('position',len('heights')),[S('currentHeight',at('heights','position'))]),
    W(and(gt(len('stack'),0),gt(at('heights',at('stack',sub(len('stack'),1))),'currentHeight')),[
     V('barIndex','int',at('stack',sub(len('stack'),1))),O('stack'),V('leftEdge','int',0),
     C(gt(len('stack'),0),[S('leftEdge',add(at('stack',sub(len('stack'),1)),1))]),
     S('best',max('best',mul(at('heights','barIndex'),sub('position','leftEdge'))))
    ]),P('stack','position')
   ]),R('best')
  ],histogramCases,
  '幅1の柱を横に隙間なく並べる。各柱の高さはheights。柱の内部からはみ出さない軸平行の長方形の最大面積を返す。選ぶ連続区間における最も低い柱の高さに、区間の柱の本数を掛けた面積となる。空列と全て高さ0の列は0。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['largest-histogram-rectangle'],constraints:['heightsの長さは0以上4,096以下。各高さは0以上10,000以下。面積は40,960,000以下です。'],
   parameterDescriptions:{heights:'左から右へ並ぶ幅1の柱の高さ。'},
   examples:[example([[2,1,5,6,2,3]],10,'高さ5、幅2の長方形を柱5と6の部分に置けます。'),example([[3,3,3,3]],12,'同じ高さの4本を全部含められます。')],oracle:histogramOracle,
   scaleNotes:['最大4,096本、単調増加・減少・同じ高さ・0による分断を含みます。解法名やソースの字面ではなく結果を採点します。'],assessment:{kind:'algorithm',criteria:['全ての連続区間を考慮した最大面積','大きい入力と境界条件'],limitations:['特定のデータ構造を使ったかどうかや、端末間で公平な計算量順位は採点しません。']}});

 const rectangleCases=[
  [[]],[[0,0,1,1]],[[0,0,0,7]],[[2,3,8,3]],[[0,0,3,3,1,1,4,4]],[[0,0,3,3,0,0,3,3]],
  [[0,0,2,2,2,0,4,2]],[[0,0,10,10,2,2,8,8]],[[0,0,2,2,3,3,5,5]],
  [[0,0,4,1,0,3,4,4,0,1,1,3,3,1,4,3]],[[0,0,10000,10000]],
  [Array.from({length:24},(_,i)=>[i*400,0,i*400+500,10000]).flat()],
  [Array.from({length:24},(_,i)=>[i*100,i*80,10000-i*75,10000-i*90]).flat()],
  [Array.from({length:24},(_,i)=>{const x=(i*1777)%9000,y=(i*2381)%9000;return [x,y,Math.min(10000,x+100+i*17),Math.min(10000,y+200+i*31)];}).flat()],
  [[0,0,10000,1,0,9999,10000,10000,0,1,1,9999,9999,1,10000,9999]]
 ];
 const sortCoordinates=array=>[
  F('sortIndex',1,len(array),[
   V('coordinate','int',at(array,'sortIndex')),V('cursor','int','sortIndex'),
   W(and(gt('cursor',0),gt(at(array,sub('cursor',1)),'coordinate')),[A(array,'cursor',at(array,sub('cursor',1))),S('cursor',sub('cursor',1))]),A(array,'cursor','coordinate')
  ])
 ];
 D('graphics','rectangle-union-area','重なった描画領域の総面積','座標圧縮と領域の和集合',3,
  [['rectangles','array']],'int',[
   V('xs','array',filled(0)),V('ys','array',filled(0)),
   F('rectangleIndex',0,div(len('rectangles'),4),[
    P('xs',at('rectangles',mul('rectangleIndex',4))),P('ys',at('rectangles',add(mul('rectangleIndex',4),1))),
    P('xs',at('rectangles',add(mul('rectangleIndex',4),2))),P('ys',at('rectangles',add(mul('rectangleIndex',4),3)))
   ]),...sortCoordinates('xs'),...sortCoordinates('ys'),V('area','int',0),
   F('xIndex',1,len('xs'),[F('yIndex',1,len('ys'),[
    V('cellWidth','int',sub(at('xs','xIndex'),at('xs',sub('xIndex',1)))),V('cellHeight','int',sub(at('ys','yIndex'),at('ys',sub('yIndex',1)))),
    C(and(gt('cellWidth',0),gt('cellHeight',0)),[
     F('rectangleIndex',0,div(len('rectangles'),4),[
      C(and(and(le(at('rectangles',mul('rectangleIndex',4)),at('xs',sub('xIndex',1))),ge(at('rectangles',add(mul('rectangleIndex',4),2)),at('xs','xIndex'))),and(le(at('rectangles',add(mul('rectangleIndex',4),1)),at('ys',sub('yIndex',1))),ge(at('rectangles',add(mul('rectangleIndex',4),3)),at('ys','yIndex')))),[S('area',add('area',mul('cellWidth','cellHeight'))),B])
     ])
    ])
   ])]),R('area')
  ],rectangleCases,
  'rectanglesは[x1,y1,x2,y2]の繰り返しで、各矩形は左下(x1,y1)から右上(x2,y2)までを覆う。少なくとも一つの矩形に覆われる面積を返す。重なりは1回だけ数え、幅0・高さ0の矩形は面積を持たない。辺や点で接するだけでは面積を増やさない。座標の大きさに比例した画素配列を用意する必要はない。',
  [],{skipGenericContract:true,difficultyRationale:difficultyRationales['rectangle-union-area'],constraints:['矩形は0以上24個以下で、rectanglesの長さは4の倍数です。','0≦x1≦x2≦10,000、0≦y1≦y2≦10,000。面積は100,000,000以下です。'],
   parameterDescriptions:{rectangles:'左下x、左下y、右上x、右上yを4個ずつ並べた矩形列。'},
   examples:[example([[0,0,3,3,1,1,4,4]],14,'各面積9の合計18から、重なり4を一度引きます。'),example([[0,0,2,2,2,0,4,2]],8,'辺で接する2枚なので、面積4と4を足します。')],oracle:unionOracle,
   scaleNotes:['最大24矩形。座標10,000の領域・包含・重複・穴・細い帯を含みます。'],assessment:{kind:'algorithm',criteria:['重複を一度だけ数える和集合の面積','退化した矩形、接する境界と大きい座標'],limitations:['Mermaid図やソースの形ではなく、指定した入力に対する面積を採点します。']}});
}
