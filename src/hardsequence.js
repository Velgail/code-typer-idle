// Original problem: noncommutative range products under coordinate changes.
// Expected results use direct per-element substitution; the reference keeps
// bidirectional products and composable lazy tags in an explicit-stack tree.
const MODULUS=1009;
const norm=value=>((value%MODULUS)+MODULUS)%MODULUS;

export function coordinateSkillSequenceOracle([initial,operations]){
 const maps=[];
 for(let i=0;i<initial.length;i+=2)maps.push([initial[i],initial[i+1]]);
 const output=[];
 for(let offset=0;offset<operations.length;offset+=5){
  const [kind,left,right,a,b]=operations.slice(offset,offset+5);
  if(kind===0){maps[left]=[a,b];continue;}
  if(kind===1){
   // g(f(g^-1(x))) has coefficient a and constant s*b+t*(1-a).
   for(let i=left;i<right;i++)maps[i][1]=norm(a*maps[i][1]+b*(1-maps[i][0]));
  }else{
   let result=a;
   if(kind===2)for(let i=left;i<right;i++)result=norm(maps[i][0]*result+maps[i][1]);
   else for(let i=right-1;i>=left;i--)result=norm(maps[i][0]*result+maps[i][1]);
   output.push(result);
  }
 }
 return output;
}

function generatedCase(count,operationCount,seed){
 const next=limit=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};
 const initial=Array.from({length:count},()=>[next(MODULUS),next(MODULUS)]).flat(),operations=[];
 for(let i=0;i<operationCount;i++){
  const kind=i%11===0?0:i%3===0?1:2+i%2;
  if(kind===0){operations.push(0,next(count),0,next(MODULUS),next(MODULUS));continue;}
  let left=next(count+1),right=next(count+1);if(left>right)[left,right]=[right,left];
  // Mix broad updates with narrow queries and point replacements after lazy work.
  if(i%7===0){left=0;right=count;}
  operations.push(kind,left,right,kind===1?(next(2)?1:-1):next(MODULUS),kind===1?next(MODULUS):0);
 }
 return [initial,operations];
}

export const HARD_SEQUENCE_CASES=[
 [[],[]],
 [[],[2,0,0,27,0,1,0,0,-1,20,3,0,0,1008,0]],
 [[2,1,3,4],[2,0,2,5,0,3,0,2,5,0]],
 [[2,1,3,4],[1,0,2,-1,10,2,0,2,5,0,3,0,2,5,0]],
 [[2,1,3,4],[1,0,2,1,7,1,0,2,-1,11,2,0,2,5,0,3,0,2,5,0]],
 [[2,1,3,4,5,6,7,8],[1,0,4,-1,1008,0,2,0,0,7,2,0,4,0,0,3,0,4,0,0]],
 [[0,7,1,5,1008,0],[2,0,3,1008,0,3,0,3,1008,0,1,0,3,-1,0,2,0,3,0,0,3,0,3,0,0]],
 [[8,9],[1,0,1,-1,0,1,0,1,-1,0,2,0,1,13,0,3,0,1,13,0]],
 [[2,3,5,7,11,13],[1,0,2,1,4,1,1,3,-1,8,2,0,3,6,0,3,0,3,6,0,2,1,1,997,0]],
 [[1,1008,1008,1008,0,1008],[1,0,3,-1,1008,1,0,3,1,1008,1,1,3,-1,997,2,0,3,1008,0,3,0,3,1008,0]],
 generatedCase(7,80,179),
 generatedCase(31,192,811),
 generatedCase(129,384,431),
 generatedCase(8192,8192,293)
];

export function registerHardSequenceChallenges(D,ir){
 const {V,S,A,P,C,F,W,R,N,add,sub,mul,div,mod,eq,ne,lt,le,gt,ge,and,or,at,len,filled}=ir;
 // apply's arguments stay strictly between -1009^2 and 1009^2, so one
 // positive offset replaces the second remainder without changing the result.
 const normal=value=>mod(add(value,MODULUS*MODULUS),MODULUS);
 const pull=node=>[
  V('pullLeft','int',mul(node,2)),V('pullRight','int',add('pullLeft',1)),
  A('productA',node,mod(mul(at('productA','pullLeft'),at('productA','pullRight')),MODULUS)),
  A('forwardB',node,mod(add(mul(at('productA','pullRight'),at('forwardB','pullLeft')),at('forwardB','pullRight')),MODULUS)),
  A('reverseB',node,mod(add(mul(at('productA','pullLeft'),at('reverseB','pullRight')),at('reverseB','pullLeft')),MODULUS))
 ];
 const apply=(node,sign,shift)=>[
  A('forwardB',node,normal(add(mul(sign,at('forwardB',node)),mul(shift,sub(1,at('productA',node)))))),
  A('reverseB',node,normal(add(mul(sign,at('reverseB',node)),mul(shift,sub(1,at('productA',node)))))),
  A('lazySign',node,normal(mul(sign,at('lazySign',node)))),
  A('lazyShift',node,normal(add(mul(sign,at('lazyShift',node)),shift)))
 ];
 // A negative node requests a postorder pull. At most two pending frames per
 // tree level are retained: <=27 for 8192 leaves, within the 64-slot stack.
 const push=(node,phase)=>[A('stackNode','stackSize',phase===1?sub(0,node):node),S('stackSize',add('stackSize',1))];
 const body=[
  V('count','int',div(len('initial'),2)),V('size','int',1),W(lt('size','count'),[S('size',mul('size',2))]),
  V('nodeLeft','array',filled(mul('size',2))),V('nodeRight','array',filled(mul('size',2))),A('nodeRight',1,'size'),
  F('node',1,'size',[
   V('middle','int',div(add(at('nodeLeft','node'),at('nodeRight','node')),2)),V('leftChild','int',mul('node',2)),V('rightChild','int',add('leftChild',1)),
   A('nodeLeft','leftChild',at('nodeLeft','node')),A('nodeRight','leftChild','middle'),A('nodeLeft','rightChild','middle'),A('nodeRight','rightChild',at('nodeRight','node'))
  ]),
  V('productA','array',filled(mul('size',2),1)),V('forwardB','array',filled(mul('size',2))),V('reverseB','array',filled(mul('size',2))),
  V('lazySign','array',filled(mul('size',2),1)),V('lazyShift','array',filled(mul('size',2))),
  F('i',0,'count',[
   V('leaf','int',add('size','i')),A('productA','leaf',at('initial',mul('i',2))),
   A('forwardB','leaf',at('initial',add(mul('i',2),1))),A('reverseB','leaf',at('initial',add(mul('i',2),1)))
  ]),
  V('buildNode','int',sub('size',1)),W(gt('buildNode',0),[...pull('buildNode'),S('buildNode',sub('buildNode',1))]),
  V('output','array',filled(0)),V('stackNode','array',filled(64)),V('stackSize','int',0),
  F('operation',0,div(len('operations'),5),[
   V('offset','int',mul('operation',5)),V('kind','int',at('operations','offset')),
   V('queryLeft','int',at('operations',add('offset',1))),V('queryRight','int',at('operations',add('offset',2))),
   V('first','int',at('operations',add('offset',3))),V('second','int',at('operations',add('offset',4))),V('answer','int','first'),
   C(eq('kind',0),[S('queryRight',add('queryLeft',1))]),
   C(lt('queryLeft','queryRight'),push(1,0)),
   W(gt('stackSize',0),[
    S('stackSize',sub('stackSize',1)),V('node','int',at('stackNode','stackSize')),
    C(lt('node',0),[S('node',sub(0,'node')),...pull('node')],[
     V('left','int',at('nodeLeft','node')),V('right','int',at('nodeRight','node')),
     C(and(lt('left','queryRight'),lt('queryLeft','right')),[
      C(and(le('queryLeft','left'),le('right','queryRight')),[
       C(eq('kind',0),[
        A('productA','node','first'),A('forwardB','node','second'),A('reverseB','node','second'),A('lazySign','node',1),A('lazyShift','node',0)
       ],[
        C(eq('kind',1),apply('node','first','second'),[
         V('constant','int',at('forwardB','node')),C(eq('kind',3),[S('constant',at('reverseB','node'))]),
         S('answer',mod(add(mul(at('productA','node'),'answer'),'constant'),MODULUS))
        ])
       ])
      ],[
       V('middle','int',div(add('left','right'),2)),V('childLeft','int',mul('node',2)),V('childRight','int',add('childLeft',1)),
       N('Push the parent coordinate change before replacing or visiting a child.'),
       C(or(ne(at('lazySign','node'),1),ne(at('lazyShift','node'),0)),[
        V('parentSign','int',at('lazySign','node')),V('parentShift','int',at('lazyShift','node')),
        ...apply('childLeft','parentSign','parentShift'),...apply('childRight','parentSign','parentShift'),A('lazySign','node',1),A('lazyShift','node',0)
       ]),
       C(lt('kind',2),push('node',1)),
       N('A reverse query visits the right child before the left child.'),
       C(eq('kind',3),[
        C(lt('queryLeft','middle'),push('childLeft',0)),C(lt('middle','queryRight'),push('childRight',0))
       ],[
        C(lt('middle','queryRight'),push('childRight',0)),C(lt('queryLeft','middle'),push('childLeft',0))
       ])
      ])
     ])
    ])
   ]),
   C(ge('kind',2),[P('output','answer')])
  ]),R('output')
 ];
 D('design','coordinate-skill-sequence','座標系を切り替える双方向スキル列','非可換な区間合成と遅延変換の合成',4,
  [['initial','array'],['operations','array']],'array',body,HARD_SEQUENCE_CASES,
  'スキル列の各要素は f(x)=(a*x+b) mod 1009 という変換。initialは[a0,b0,a1,b1,...]。operationsを先頭から処理し、問い合わせ結果だけを順に返す。'
  +' 操作は5整数ずつ。 [0,p,0,a,b] は位置pを新しいf(x)=a*x+bへ置換する。過去の座標変更を新しいfへ適用してはいけない。'
  +' [1,l,r,s,t] は区間[l,r)の各スキルfを g∘f∘g^-1 へ置換する。g(x)=(s*x+t) mod 1009、sは1か-1。g^-1(x)=s*(x-t) mod 1009。合成h∘fは「fを先に、hを後に適用」の意味。'
  +' [2,l,r,x,0] はxへf_l,f_(l+1),...,f_(r-1)をこの順に適用した値を返す。 [3,l,r,x,0] はxへf_(r-1),...,f_lをこの順に適用する。逆順は逆関数の適用ではない。'
  +' どの演算も結果を0〜1008の剰余へ正規化する。空区間の問い合わせはx、空区間の座標変更は何もしない。点置換・座標変更は結果を出力しない。',
  ['io/dynamic-range-sums'],{
   oracle:coordinateSkillSequenceOracle,skipGenericContract:true,executionBudgetMsByLanguage:{rust:300000},
   constraints:[
    'スキル数nは0〜8192。initialの長さは2*n、各a,bは0〜1008。a=0も許す。fの逆関数は要求しない。',
    '操作数は0〜8192、operationsの長さは5の倍数。操作種別は0,1,2,3のいずれか。',
    '点置換は0<=p<n、a,bは0〜1008、3番目のフィールドは0。',
    'それ以外の操作は0<=l<=r<=n。座標変更のsは1か-1、tは0〜1008。問い合わせのxは0〜1008、最後のフィールドは0。',
    '負数の剰余を負のまま返してはいけない。例えば-1 mod1009は1008。操作のフィールドは上記の形式に従う。'
   ],
   parameterDescriptions:{initial:'スキル変換f_i(x)=a_i*x+b_iの係数[a0,b0,a1,b1,...]。',operations:'5整数ずつの操作列。種別0:点置換、1:区間の座標変更、2:正順評価、3:逆順評価。'},
   examples:[
    {args:[[2,1,3,4],[2,0,2,5,0,3,0,2,5,0]],expected:[37,39],explanation:'正順は5→11→37。逆順は5→19→39。同じ区間でも適用順で結果が変わる。'},
    {args:[[2,1,3,4],[1,0,2,-1,10,2,0,2,5,0,3,0,2,5,0]],expected:[982,980],explanation:'g(x)=-x+10で座標変更するとf0は2*x-11、f1は3*x-24。正順は5→1008→982、逆順は5→1000→980。負数も0〜1008へ正規化する。'},
    {args:[[2,1,3,4],[1,0,2,1,7,0,1,0,1,0,2,0,2,5,0]],expected:[4],explanation:'座標変更後f0は2*x-6。位置1を恒等変換xへ置換するので、古い座標変更は新しいf1へ影響しない。5→4→4。'}
   ],
   assessment:{kind:'algorithm',criteria:['正順・逆順の非可換な変換合成','座標変更の合成順と点置換への遅延作用の分離','操作列を通じた剰余の正規化'],limitations:['正しい入出力を採点する。データ構造の名前やクラスの構成は指定しない。']},
   difficultyRationale:{classification:'composed-invariants',requiredSkills:['非可換な関数合成','区間集約','遅延作用と作用合成','双方向の不変量'],reasoning:'区間内の各変換への共役作用を区間積へ持ち上げ、更新タグの合成順を保つ。正順・逆順の集約と、座標変更後に点置換するケースの遅延作用を整合させる。',constraintRole:'最大8192スキル・8192操作、非2冪長、全域更新後の部分区間評価と点置換、a=0と負の剰余を含む。問題文の式だけを順に処理する正しい単純解も禁止しない。',timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'},
   scaleNotes:['8192要素・8192操作を混在させたケースを含む。','掛け算の順序や座標変更タグの合成順を入れ替えると結果が変わる。','逆向き評価は逆関数ではなく、同じスキルの適用順だけを逆にする。']
  });
}
