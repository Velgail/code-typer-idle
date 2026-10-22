// Original compound routing problem. The generated reference uses ternary
// states; expected answers use a separately written backwards mask recurrence.
const INF=1000000000;

export function compoundDeliveryOracle([weights,capacity,travel,appointments]) {
 const count=weights.length,points=2*count+1;
 if(!count)return 0;
 const full=(1<<count)-1,memo=new Map();
 function finish(picked,delivered,last){
  if(delivered&~picked)return INF;
  if(last===0)return picked===0&&delivered===0?0:INF;
  const key=(picked*(full+1)+delivered)*points+last;
  if(memo.has(key))return memo.get(key);
  const item=(last-1)%count,bit=1<<item;
  let previousPicked=picked,previousDelivered=delivered;
  if(last<=count){
   if(!(picked&bit)||(delivered&bit))return INF;
   previousPicked^=bit;
  }else{
   if(!(delivered&bit))return INF;
   previousDelivered^=bit;
  }
  let load=0;
  for(let i=0;i<count;i++)if((picked&(1<<i))&&!(delivered&(1<<i)))load+=weights[i];
  if(load>capacity)return INF;
  let arrival=INF;
  for(let previous=0;previous<points;previous++)arrival=Math.min(arrival,finish(previousPicked,previousDelivered,previous)+travel[previous*points+last]);
  const offset=(last-1)*3,start=Math.max(arrival,appointments[offset]);
  const result=start<=appointments[offset+1]?start+appointments[offset+2]:INF;
  memo.set(key,result);return result;
 }
 let answer=INF;
 for(let item=0;item<count;item++)answer=Math.min(answer,finish(full,full,count+item+1)+travel[(count+item+1)*points]);
 return answer===INF?-1:answer;
}

const uniformTravel=count=>Array.from({length:(2*count+1)**2},(_,i)=>Math.floor(i/(2*count+1))===i%(2*count+1)?0:1);
const broadAppointments=count=>Array.from({length:2*count},()=>[0,300,0]).flat();
function patternedTravel(count,seed){
 const points=2*count+1;
 return Array.from({length:points*points},(_,i)=>Math.floor(i/points)===i%points?0:(Math.floor(i/points)*17+(i%points)*23+seed*11)%13);
}
const capacityWindows=[0,2,0,0,2,0,0,20,0,0,20,0];
const serviceWindows=broadAppointments(2);serviceWindows[2]=3;serviceWindows[4]=2;
const urgentDeliveryWindows=broadAppointments(2);urgentDeliveryWindows[7]=2;
const strictWindows=broadAppointments(6);
for(let i=0;i<6;i++){
 strictWindows.splice(i*3,3,4*i+1,4*i+1,1);
 strictWindows.splice((6+i)*3,3,4*i+3,4*i+3,1);
}
const broadLarge=broadAppointments(6);
for(let point=0;point<12;point++)broadLarge[point*3+2]=(point*3+1)%4;
const waitChangesRoute=Array.from({length:25},(_,i)=>Math.floor(i/5)===i%5?0:20);
for(const [from,to,time] of [[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,0,1],[1,3,1],[3,2,2],[2,4,1]])waitChangesRoute[from*5+to]=time;
const latePickupWindow=broadAppointments(2);latePickupWindow[3]=50;

export const COMPOUND_DELIVERY_CASES=[
 [[],0,[0],[]],
 [[2],2,[0,2,9,4,0,3,5,6,0],[0,20,1,0,20,2]],
 [[1],1,uniformTravel(1),[5,5,2,8,8,3]],
 [[3],2,uniformTravel(1),broadAppointments(1)],
 [[1],1,uniformTravel(1),[0,0,0,0,20,0]],
 [[1],1,[0,2,0,0,0,9,1,0,0],broadAppointments(1)],
 [[1,1],1,[0,1,40,40,40,40,0,1,20,40,40,40,0,1,1,1,40,1,0,40,1,1,40,40,0],broadAppointments(2)],
 [[1,1],1,uniformTravel(2),[0,20,0,0,1,0,0,20,0,0,20,0]],
 [[2,1],3,uniformTravel(2),capacityWindows],
 [[2,1],2,uniformTravel(2),capacityWindows],
 [[1,1],2,uniformTravel(2),serviceWindows],
 [[1],1,Array(9).fill(0),[0,0,0,0,0,0]],
 [[1],1,[0,0,5,7,0,0,40,9,0],broadAppointments(1)],
 [[1,1],2,uniformTravel(2),urgentDeliveryWindows],
 [[1,2,1,2,1,2],4,patternedTravel(6,3),broadLarge],
 [[1,2,1,2,1,2],2,uniformTravel(6),strictWindows],
 [[1,1,1],0,uniformTravel(3),broadAppointments(3)],
 [[1],1,uniformTravel(1),[0,20,1,0,2,0]],
 [[1,2,1,2],3,patternedTravel(4,7),[0,10,0,0,12,1,5,20,1,0,25,0,10,35,2,0,40,0,20,50,3,0,60,1]],
 [[1,1],2,waitChangesRoute,latePickupWindow]
];

export function registerCompoundDeliveryChallenges(D,ir){
 const {V,S,A,C,F,R,N,add,sub,mul,div,mod,eq,lt,le,ge,and,or,at,len,filled,min,max}=ir;
 const examples=[
  {args:[[1],1,uniformTravel(1),[5,5,2,8,8,3]],expected:12,explanation:'集荷点へ時刻1に着いて5まで待機し、作業は5〜7。配達点は8〜11に作業します。受付終了は作業開始の期限なので、拠点に戻る時刻12まで実行できます。'},
  {args:[[2,1],2,uniformTravel(2),capacityWindows],expected:-1,explanation:'両方を集荷してから配達すると積載上限を超えます。片方を配達してから残りを集荷すると、もう一方の受付期限2に間に合いません。'}
 ];
 D('systems','windowed-pickup-delivery','受付時刻と積載を守る集荷・配達','先行関係・積載・受付時刻を組み合わせた経路計画',5,
  [['weights','array'],['capacity','int'],['travel','array'],['appointments','array']],'int',[
   V('count','int',len('weights')),C(eq('count',0),[R(0)]),
   V('points','int',add(mul('count',2),1)),V('powers','array',filled(add('count',1))),A('powers',0,1),
   F('item',0,'count',[A('powers',add('item',1),mul(at('powers','item'),3))]),
   V('states','int',at('powers','count')),V('best','array',filled(mul('states','points'),INF)),A('best',0,0),
   N('A parcel can be uncollected, on board, or delivered.'),
   F('state',0,'states',[
    V('load','int',0),
    F('item',0,'count',[C(eq(mod(div('state',at('powers','item')),3),1),[S('load',add('load',at('weights','item')))])]),
    F('last',0,'points',[
     V('ready','int',at('best',add(mul('state','points'),'last'))),
     C(lt('ready',INF),[
      F('item',0,'count',[
       V('status','int',mod(div('state',at('powers','item')),3)),
       C(and(lt('status',2),or(eq('status',1),le(add('load',at('weights','item')),'capacity'))),[
        V('next','int',add('item',1)),C(eq('status',1),[S('next',add('next','count'))]),
        V('offset','int',mul(sub('next',1),3)),V('arrival','int',add('ready',at('travel',add(mul('last','points'),'next')))),
        V('start','int',max('arrival',at('appointments','offset'))),
        C(le('start',at('appointments',add('offset',1))),[
         V('finish','int',add('start',at('appointments',add('offset',2)))),
         V('nextState','int',add('state',at('powers','item'))),V('index','int',add(mul('nextState','points'),'next')),
         A('best','index',min(at('best','index'),'finish'))
        ])
       ])
      ])
     ])
    ])
   ]),
   V('answer','int',INF),F('last',add('count',1),'points',[
    V('finish','int',at('best',add(mul(sub('states',1),'points'),'last'))),
    C(lt('finish',INF),[S('answer',min('answer',add('finish',at('travel',mul('last','points')))))])
   ]),C(eq('answer',INF),[R(-1)]),R('answer')
  ],COMPOUND_DELIVERY_CASES,
  '荷物数nはweightsの長さです。時刻0に空荷で拠点0を出発し、荷物iの集荷点i+1と配達点n+i+1をそれぞれ1回ずつ訪れ、全荷物を配達して拠点0へ戻る最早時刻を返してください。荷物iは集荷後にだけ配達でき、集荷から配達までweights[i]の積載を使います。積載重量の合計は常にcapacity以下とします。各作業地点pではappointmentsの3*(p-1)から[受付開始,受付終了,作業時間]を読みます。到着後は任意に待機でき、受付開始以上かつ受付終了以下の時刻に作業を開始し、作業時間が経過してから出発します。作業終了が受付終了を超えることは許されます。移動はtravel[from*(2*n+1)+to]だけかかります。追加の中継訪問や途中の拠点帰還はできません。全配達を終えた後は最後の配達点から拠点へ直接戻ります。実行可能な順序がなければ-1、荷物が0個なら0を返します。',
  ['io/traveling-courier','io/knapsack'],{
   constraints:[
    'nは0〜6。weightsの各値は1〜9、capacityは0〜20です。',
    'travelの長さは(2*n+1)^2。行が出発点、列が到着点で、各移動時間は0〜40、対角成分は0です。非対称でもよく、三角不等式は保証しません。',
    'appointmentsの長さは6*n。各受付時刻は0〜300で、0<=受付開始<=受付終了<=300。各作業時間は0〜10です。',
    'n=0ではtravel=[0]、appointments=[]。地点番号・添字・時刻はすべて整数で、添字は0始まりです。'
   ],
   parameterDescriptions:{weights:'荷物iの重量。長さnが荷物数です。',capacity:'同時に積める重量の上限。',travel:'地点0から2*nまでの直接移動時間を行優先に並べた行列。',appointments:'作業地点1から2*nまでの[受付開始,受付終了,作業時間]を順に連結した列。'},
   oracle:compoundDeliveryOracle,examples,skipGenericContract:true,
   scaleNotes:['6荷物・12作業地点のケースと、先行関係・容量・待機・受付期限の組み合わせによって最適順序が変わるケースを含みます。'],
   assessment:{kind:'algorithm',criteria:['集荷と配達の先行関係','全訪問での積載上限と作業開始期限','待機と作業時間、最後の帰還を含めた最小終了時刻'],limitations:['経路の最小終了時刻を採点し、特定のデータ構造・実装方法は要求しません。']},
   difficultyRationale:{classification:'compound-constraints',requiredSkills:['集荷と配達の先行関係','荷物の状態に依存する積載量','待機できる受付時間窓','非対称な移動時間'],reasoning:'同じ訪問済み地点数でも積載・未配達の荷物・現在地点が異なると続けられる訪問が変わる。時刻窓を満たす順序と、保持すべき状態の設計が必要。',constraintRole:'6荷物・12作業地点を扱い、先行関係・容量・時刻窓のどれかを省略した解法を反例で検証する。特定の実装方法は要求しない。',timeBasis:'報酬は新規の解説原文を受領するまでの直接観測に基づく。旧分数は撤回し、人間の所要分数へ換算しない。'}
  });
}
