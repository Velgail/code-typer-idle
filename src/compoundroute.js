// Original compound route problem. Results are checked against an independent
// label-correcting oracle; the generated reference uses a binary min-heap.
export function consumableGateRouteOracle([nodes,edges,initialKeys,supplies,doors,start,goal]){
 const supplyCount=supplies.length/3,doorCount=doors.length/2,doorStates=1<<doorCount;
 const nodeSupply=Array(nodes).fill(0),outgoing=Array.from({length:nodes},()=>[]);
 for(let i=0;i<supplyCount;i++)nodeSupply[supplies[i*3]]|=1<<i;
 for(let i=0;i<edges.length;i+=6)outgoing[edges[i]].push(edges.slice(i,i+6));
 const encode=(node,taken,opened)=>(taken*doorStates+opened)*nodes+node;
 const first=encode(start,nodeSupply[start],0),distance=Array(nodes*(1<<supplyCount)*doorStates).fill(Infinity);
 const queued=Array(distance.length).fill(false),queue=[first];distance[first]=0;queued[first]=true;
 for(let head=0;head<queue.length;head++){
  const state=queue[head];queued[state]=false;
  const node=state%nodes,history=Math.floor(state/nodes),opened=history%doorStates,taken=Math.floor(history/doorStates);
  const stock=[...initialKeys];
  for(let i=0;i<supplyCount;i++)if(taken&(1<<i))stock[supplies[i*3+1]]+=supplies[i*3+2];
  for(let i=0;i<doorCount;i++)if(opened&(1<<i))stock[doors[i*2]]--;
  for(const [,to,travel,period,phase,door] of outgoing[node]){
   let nextOpened=opened,depart=distance[state];
   if(door>=0&&!(opened&(1<<door))){
    if(stock[doors[door*2]]===0)continue;
    nextOpened|=1<<door;depart+=doors[door*2+1];
   }
   // Find the next permitted departure directly instead of sharing the
   // reference's modular waiting expression.
   while(depart%period!==phase)depart++;
   const next=encode(to,taken|nodeSupply[to],nextOpened),arrival=depart+travel;
   if(arrival<distance[next]){
    distance[next]=arrival;
    if(!queued[next]){queue.push(next);queued[next]=true;}
   }
  }
 }
 let answer=Infinity;
 for(let state=goal;state<distance.length;state+=nodes)answer=Math.min(answer,distance[state]);
 return Number.isFinite(answer)?answer:-1;
}

export function registerCompoundRouteChallenges(D,ir){
 const {V,S,A,P,O,C,F,W,R,B,N,add,sub,mul,div,mod,eq,ne,lt,le,gt,ge,and,at,len,filled,band,bor,shl}=ir;
 const swapHeap=[
  V('swapState','int',at('heapStates','heapCursor')),V('swapTime','int',at('heapTimes','heapCursor')),
  A('heapStates','heapCursor',at('heapStates','heapOther')),A('heapTimes','heapCursor',at('heapTimes','heapOther')),
  A('heapStates','heapOther','swapState'),A('heapTimes','heapOther','swapTime'),S('heapCursor','heapOther')
 ];
 const chain=[
  [0,1,1,1,0,0],[1,2,1,1,0,-1],[2,1,1,1,0,0],
  [1,0,1,1,0,0],[0,3,1,1,0,1]
 ].flat();
 const largeEdges=[];
 for(let from=0;from<23;from++)for(const step of [1,2,3,5,7,11]){
  const period=1+(from+step)%7;
  largeEdges.push(from,(from+step)%23,(from*7+step*3)%9,period,(from*5+step)%period,(from+step)%5-1);
 }
 const largeSupplies=[0,0,1,6,1,2,12,0,2,18,1,1],largeDoors=[0,0,1,2,0,3,1,1];
 const cases=[
  [1,[],[0,0],[],[],0,0],
  [2,[],[0,0],[],[],0,1],
  [2,[0,1,3,1,0,-1],[0,0],[],[],0,1],
  [2,[0,1,2,4,3,-1],[0,0],[],[],0,1],
  [2,[0,1,2,4,1,0],[1,0],[],[0,3],0,1],
  [2,[0,1,0,1,0,0],[0,0],[0,1,1],[1,0],0,1],
  [2,[0,1,1,1,0,0],[0,1],[],[0,0],0,1],
  [4,chain,[1,0],[2,1,1],[0,1,1,2],0,3],
  [4,[0,1,0,1,0,-1,1,2,1,1,0,0,2,1,0,1,0,-1,2,3,1,1,0,1],[0,0],[1,0,1],[0,0,0,0],0,3],
  [4,[0,1,1,1,0,-1,0,2,3,1,0,-1,2,1,1,1,0,-1,1,3,1,1,0,0],[0,0],[2,0,1],[0,0],0,3],
  [3,[0,1,0,1,0,0,1,2,0,1,0,1],[0,0],[0,0,2],[0,0,0,0],0,2],
  [3,[0,1,1,1,0,0,1,2,1,1,0,1],[0,0],[0,0,1,0,1,1],[0,0,1,0],0,2],
  [3,[0,1,0,1,0,-1,1,0,0,1,0,-1,1,2,0,2,1,0],[0,0],[1,0,1],[0,0],0,2],
  [3,[0,1,2,3,2,0,1,2,1,3,1,0],[1,0],[],[0,3],0,2],
  [4,[0,3,20,1,0,-1,0,1,1,2,1,-1,1,2,1,3,2,0,2,3,1,2,0,1],[0,0],[1,0,1,2,1,1],[0,0,1,1],0,3],
  [5,[0,1,1,1,0,0,1,2,1,1,0,1,2,3,1,1,0,2,3,4,1,1,0,3],[2,0],[0,0,2],[0,0,0,0,0,0,0,0],0,4],
  [24,largeEdges,[0,1],largeSupplies,largeDoors,0,22],
  [24,largeEdges,[0,1],largeSupplies,largeDoors,0,23]
 ];
 D('systems','consumable-gate-route','消耗鍵と時刻ゲートの最短経路','回収・解錠の履歴と時刻による経路選択',5,25,
  [['nodes','int'],['edges','array'],['initialKeys','array'],['supplies','array'],['doors','array'],['start','int'],['goal','int']],'int',[
   V('supplyCount','int',div(len('supplies'),3)),V('doorCount','int',div(len('doors'),2)),
   V('doorStates','int',shl(1,'doorCount')),V('stateCount','int',mul(mul('nodes',shl(1,'supplyCount')),'doorStates')),
   V('nodeSupplies','array',filled('nodes')),
   F('supplyIndex',0,'supplyCount',[V('supplyNode','int',at('supplies',mul('supplyIndex',3))),A('nodeSupplies','supplyNode',bor(at('nodeSupplies','supplyNode'),shl(1,'supplyIndex')))]),
   V('firstState','int',add(mul(mul(at('nodeSupplies','start'),'doorStates'),'nodes'),'start')),
   V('distances','array',filled('stateCount',1000000000)),A('distances','firstState',0),
   V('heapStates','array',filled(0)),V('heapTimes','array',filled(0)),P('heapStates','firstState'),P('heapTimes',0),
   N('A state keeps the current node, collected supplies and permanently opened doors.'),
   W(gt(len('heapStates'),0),[
    V('state','int',at('heapStates',0)),V('elapsed','int',at('heapTimes',0)),
    V('heapLast','int',sub(len('heapStates'),1)),V('lastState','int',at('heapStates','heapLast')),V('lastTime','int',at('heapTimes','heapLast')),
    O('heapStates'),O('heapTimes'),
    C(gt(len('heapStates'),0),[
     A('heapStates',0,'lastState'),A('heapTimes',0,'lastTime'),V('heapCursor','int',0),
     W(lt(add(mul('heapCursor',2),1),len('heapStates')),[
      V('heapOther','int',add(mul('heapCursor',2),1)),V('heapRight','int',add('heapOther',1)),
      C(lt('heapRight',len('heapStates')),[C(lt(at('heapTimes','heapRight'),at('heapTimes','heapOther')),[S('heapOther','heapRight')])]),
      C(le(at('heapTimes','heapCursor'),at('heapTimes','heapOther')),[B]),...swapHeap
     ])
    ]),
    C(eq('elapsed',at('distances','state')),[
     V('node','int',mod('state','nodes')),V('history','int',div('state','nodes')),
     V('opened','int',mod('history','doorStates')),V('collected','int',div('history','doorStates')),
     C(eq('node','goal'),[R('elapsed')]),
     V('stockZero','int',at('initialKeys',0)),V('stockOne','int',at('initialKeys',1)),
     F('stockSupply',0,'supplyCount',[
      C(ne(band('collected',shl(1,'stockSupply')),0),[
       V('supplyOffset','int',mul('stockSupply',3)),
       C(eq(at('supplies',add('supplyOffset',1)),0),[S('stockZero',add('stockZero',at('supplies',add('supplyOffset',2))))],[S('stockOne',add('stockOne',at('supplies',add('supplyOffset',2))))])
      ])
     ]),
     F('stockDoor',0,'doorCount',[
      C(ne(band('opened',shl(1,'stockDoor')),0),[
       C(eq(at('doors',mul('stockDoor',2)),0),[S('stockZero',sub('stockZero',1))],[S('stockOne',sub('stockOne',1))])
      ])
     ]),
     F('edgeIndex',0,div(len('edges'),6),[
      V('edgeOffset','int',mul('edgeIndex',6)),
      C(eq(at('edges','edgeOffset'),'node'),[
       V('nextOpened','int','opened'),V('depart','int','elapsed'),V('usable','int',1),V('door','int',at('edges',add('edgeOffset',5))),
       C(ge('door',0),[
        V('doorBit','int',shl(1,'door')),
        C(eq(band('opened','doorBit'),0),[
         V('available','int','stockZero'),C(eq(at('doors',mul('door',2)),1),[S('available','stockOne')]),
         C(eq('available',0),[S('usable',0)],[S('nextOpened',bor('opened','doorBit')),S('depart',add('depart',at('doors',add(mul('door',2),1))))])
        ])
       ]),
       C(eq('usable',1),[
        V('period','int',at('edges',add('edgeOffset',3))),V('phase','int',at('edges',add('edgeOffset',4))),
        N('Unlocking work happens before waiting for the next permitted departure.'),
        V('wait','int',mod(add(sub('phase',mod('depart','period')),'period'),'period')),
        V('arrival','int',add(add('depart','wait'),at('edges',add('edgeOffset',2)))),V('nextNode','int',at('edges',add('edgeOffset',1))),
        V('nextCollected','int',bor('collected',at('nodeSupplies','nextNode'))),
        V('nextState','int',add(mul(add(mul('nextCollected','doorStates'),'nextOpened'),'nodes'),'nextNode')),
        C(lt('arrival',at('distances','nextState')),[
         A('distances','nextState','arrival'),P('heapStates','nextState'),P('heapTimes','arrival'),V('heapCursor','int',sub(len('heapStates'),1)),
         W(gt('heapCursor',0),[
          V('heapOther','int',div(sub('heapCursor',1),2)),C(le(at('heapTimes','heapOther'),at('heapTimes','heapCursor')),[B]),...swapHeap
         ])
        ])
       ])
      ])
     ])
    ])
   ]),R(-1)
  ],cases,
  '時刻0にstartから出発し、goalへ最も早く到着する時刻を返す。到達不能なら-1。各辺は一方通行で、地点への再訪と任意の待機ができる。'
  +' suppliesは[地点,鍵の種類,個数]の繰り返し。到着時（出発地点を含む）に、その地点の未取得レコードをすべて自動取得する。各レコードから得られるのは全経路を通じて一度だけ。'
  +' doorsは[必要な鍵の種類,解錠作業時間]の繰り返し。鍵の種類は0と1。'
  +' edgesは[from,to,移動時間,周期,開く位相,扉ID]の繰り返し。扉ID=-1なら扉なし。同じ扉IDは異なる辺でも解錠状態を共有する。'
  +' 閉じた扉の辺を初めて通るときは、必要な種類の鍵1個を消費して解錠作業を行う。鍵がなければ通れない。扉は以後ずっと開き、再通過で鍵や解錠時間は不要。'
  +' その後、時刻を周期で割った余りが開く位相になるまで待ってから移動する。扉なし・解錠済みの辺も同じ時刻条件に従う。鍵消費→解錠作業→時刻待ち→移動→到着地点で補給、の順序。start=goalなら0。実装方法は自由。',
  ['io/key-door-shortest-path','io/weighted-paths'],{
   oracle:consumableGateRouteOracle,skipGenericContract:true,
   difficultyRationale:{classification:'compound-constraints',requiredSkills:['経路探索','消耗資源の管理','履歴を持つ状態','周期的な待機'],reasoning:'一度限りの補給、鍵を消費する恒久解錠、時刻ゲートを同じ経路状態として整合させる。単に地点への最短距離を求めるだけでは解けない。',constraintRole:'最大6144の地点・履歴状態を持つ。補給の取り直しや解錠のし直しが必要な解法を反例で検査する。',timeBasis:'provisional-pacing-budget'},
   constraints:[
    'nodesは1〜24。startとgoal、辺の両端、補給の地点は0以上nodes未満。',
    'edgesは最大144辺、長さは6の倍数。移動時間は0〜20、周期は1〜7、開く位相は0以上周期未満。平行辺と自己ループも許す。',
    'initialKeysは種類0・種類1の初期個数をこの順に持つ長さ2の列で、各初期個数は0〜2。補給後の保有個数に上限はない。',
    'suppliesは最大4件、長さは3の倍数。鍵の種類は0か1、個数は1か2。同じ地点に複数レコードがあってよい。',
    'doorsは最大4扉、長さは2の倍数。必要な鍵の種類は0か1、解錠作業時間は0〜5。辺の扉IDは-1か有効な扉の添字。',
    'すべて整数。時刻待ちや解錠中に別の辺を通ることはできない。扉と補給の状態は1本の経路の中でのみ共有する。'
   ],
   parameterDescriptions:{
    nodes:'地点数。地点番号は0からnodes-1。',edges:'有向辺を[from,to,移動時間,周期,開く位相,扉ID]の6要素ずつ並べた列。',
    initialKeys:'種類0、種類1の鍵の初期個数。',supplies:'各補給を[地点,鍵の種類,個数]の3要素ずつ並べた列。',doors:'各扉を[必要な鍵の種類,解錠作業時間]の2要素ずつ並べた列。',start:'時刻0の出発地点。',goal:'到着時刻を最小にする目的地。'
   },
   examples:[
    {args:[2,[0,1,2,4,1,0],[1,0],[],[0,3],0,1],expected:7,explanation:'時刻0から3まで解錠し、周期4の位相1となる時刻5まで待ち、2時間移動して7に到着。'},
    {args:[4,chain,[1,0],[2,1,1],[0,1,1,2],0,3],expected:8,explanation:'0→1で扉0を解錠し、2で種類1の鍵を取得する。2→1→0では開いた扉0を再利用し、0→3で扉1を解錠して8に到着。'}
   ],
   assessment:{kind:'algorithm',criteria:['一度限りの補給と鍵消費を追跡した経路選択','共有する解錠状態と周期待機を組み合わせた最早到着時刻'],limitations:['入出力の動作契約を採点し、特定のアルゴリズム名やクラス構成は要求しない。']},
   scaleNotes:['地点だけ、または現在の鍵個数だけでは区別できない経路を含む。','同じ履歴と地点では、早着した経路は後着と同じ時刻まで待てる。解法や状態の持ち方は自由。']
  });
}
