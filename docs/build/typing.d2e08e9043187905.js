// 128 curated templates, each with 16 deterministic data sets: 2,048 prompts.
// English ASCII prompts keep programming practice independent of an IME.
import { officeOrderAt } from './office.d2e08e9043187905.js';
export const LANGUAGES = [
  { id: 'cpp', name: 'C++', extension: 'cpp', description: 'ゲームエンジン、描画、メモリ管理' },
  { id: 'csharp', name: 'C#', extension: 'cs', description: 'Unity、ゲームロジック、業務API' },
  { id: 'rust', name: 'Rust', extension: 'rs', description: '安全なシステム、並列処理、ツール' },
  { id: 'go', name: 'Go', extension: 'go', description: 'サーバー、並行処理、配信基盤' },
  { id: 'python', name: 'Python', extension: 'py', description: 'データ処理、自動化、開発ツール' },
  { id: 'java', name: 'Java', extension: 'java', description: '業務システム、サーバー、サービス' },
  { id: 'sql', name: 'SQL', extension: 'sql', description: 'データ分析、集計、ストア運用' },
  { id: 'lua', name: 'Lua', extension: 'lua', description: 'ゲームスクリプト、イベント、描画' }
];
export const TYPING_REWARD = { character: 1.25, completion: 0.25 };
const VARIANTS = 16;
const DATA = {
  cpp: {
    syntax: [
      'int $name$ = $value$;\nif ($name$ > $limit$) {\n    $name$ -= $count$;\n}',
      'int sum(const std::vector<int>& $name$) {\n    int total = 0;\n    for (int value : $name$) {\n        total += value;\n    }\n    return total;\n}',
      'std::string $name$ = "$tag$";\nfor (int i = 0; i < $count$; ++i) {\n    std::cout << $name$ << i << "\\n";\n}',
      'int clamp_$name$(int value) {\n    return std::clamp(value, 0, $limit$);\n}\nconst auto result = clamp_$name$($value$);'
    ],
    design: [
      'struct $Type$ {\n    int id;\n    std::string name;\n};\n$Type$ $name${$value$, "$tag$"};',
      'class $Type$ {\npublic:\n    explicit $Type$(int value) : value_(value) {}\n    int value() const { return value_; }\nprivate:\n    int value_;\n};',
      'auto $name$ = std::make_unique<$Type$>();\n$name$->set_capacity($count$);\n$name$->load("$tag$");',
      'enum class $Type$ { Idle, Running, Done };\n$Type$ $name$ = $Type$::Idle;\nif (ready) {\n    $name$ = $Type$::Running;\n}'
    ],
    graphics: [
      'void draw_$name$(SDL_Renderer* renderer) {\n    SDL_Rect rect{ $value$, $count$, 16, 16 };\n    SDL_SetRenderDrawColor(renderer, 80, 200, 120, 255);\n    SDL_RenderFillRect(renderer, &rect);\n}',
      'glm::vec3 $name$($value$.0f, 0.0f, $count$.0f);\nglm::mat4 model(1.0f);\nmodel = glm::translate(model, $name$);\nshader.setMat4("model", model);',
      'float $name$ = $rate$f;\nfor (auto& particle : particles) {\n    particle.position += particle.velocity * $name$;\n    particle.life -= $name$;\n}',
      'glBindVertexArray($value$);\nglUseProgram(program);\nglDrawElements(GL_TRIANGLES, $count$, GL_UNSIGNED_INT, nullptr);\nglBindVertexArray(0);'
    ],
    systems: [
      'std::vector<int> $name$;\n$name$.reserve($limit$);\nfor (int i = 0; i < $count$; ++i) {\n    $name$.push_back(i * $value$);\n}',
      'std::mutex $name$;\nvoid update_$name$() {\n    std::lock_guard<std::mutex> lock($name$);\n    counter += $value$;\n}',
      'auto $name$ = std::async(std::launch::async, [] {\n    return load_asset("$tag$");\n});\nauto asset = $name$.get();',
      'using Clock = std::chrono::steady_clock;\nauto $name$ = Clock::now();\nupdate_world($count$);\nauto elapsed = Clock::now() - $name$;'
    ]
  },
  csharp: {
    syntax: [
      'int $name$ = $value$;\nif ($name$ < $limit$)\n{\n    $name$ += $count$;\n}',
      'foreach (var $name$ in players)\n{\n    if ($name$.Health > $value$)\n    {\n        $name$.Heal($count$);\n    }\n}',
      'static int Sum$Type$(int[] values)\n{\n    int total = 0;\n    foreach (int value in values) total += value;\n    return total;\n}',
      'string $name$ = "$tag$";\nvar message = $"Item: {$name$}";\nConsole.WriteLine(message);'
    ],
    design: [
      'public interface I$Type$\n{\n    void Update(float deltaTime);\n}\npublic sealed class $Type$ : I$Type$\n{\n    public void Update(float deltaTime) { }\n}',
      'public record $Type$(int Id, string Name);\nvar $name$ = new $Type$($value$, "$tag$");',
      'public event Action<int>? On$Type$;\nprivate void Notify$Type$(int value)\n{\n    On$Type$?.Invoke(value);\n}',
      'var $name$ = services.GetRequiredService<I$Type$>();\nawait $name$.SaveAsync("$tag$", cancellationToken);'
    ],
    graphics: [
      'void Update()\n{\n    float $name$ = $rate$f * Time.deltaTime;\n    transform.Translate(Vector3.forward * $name$);\n}',
      'var $name$ = GetComponent<SpriteRenderer>();\n$name$.color = new Color($rate$f, 0.8f, 0.5f);\n$name$.sortingOrder = $value$;',
      'Vector3 $name$ = new Vector3($value$, $count$, 0);\ntransform.position = Vector3.Lerp(\n    transform.position, $name$, Time.deltaTime);',
      'void Draw$Type$()\n{\n    Gizmos.color = Color.green;\n    Gizmos.DrawWireSphere(transform.position, $count$f);\n}'
    ],
    systems: [
      'using var $name$ = new HttpClient();\nvar response = await $name$.GetAsync("https://example.com/$tag$");\nresponse.EnsureSuccessStatusCode();',
      'var $name$ = new Dictionary<int, string>($limit$);\n$name$[$value$] = "$tag$";\nif ($name$.TryGetValue($value$, out var result))\n{\n    Console.WriteLine(result);\n}',
      'await Parallel.ForEachAsync($name$, async (item, token) =>\n{\n    await ProcessAsync(item, token);\n});',
      'var $name$ = new Queue<$Type$>($count$);\nwhile ($name$.Count > 0)\n{\n    $name$.Dequeue().Reset();\n}'
    ]
  },
  rust: {
    syntax: [
      'let mut $name$: i32 = $value$;\nif $name$ > $limit$ {\n    $name$ -= $count$;\n}',
      'fn sum_$name$(values: &[i32]) -> i32 {\n    values.iter().sum()\n}\nlet total = sum_$name$(&[$value$, $count$]);',
      'let $name$ = Some($value$);\nmatch $name$ {\n    Some(value) => println!("{}", value),\n    None => println!("$tag$"),\n}',
      'for $name$ in 0..$count$ {\n    if $name$ % 2 == 0 {\n        println!("{}", $name$);\n    }\n}'
    ],
    design: [
      'struct $Type$ {\n    id: u32,\n    name: String,\n}\nlet $name$ = $Type$ {\n    id: $value$,\n    name: String::from("$tag$"),\n};',
      'trait $Type$ {\n    fn update(&mut self, dt: f32);\n}\nfn tick_all(items: &mut [Box<dyn $Type$>]) {\n    for item in items { item.update($rate$); }\n}',
      'enum $Type$ {\n    Idle,\n    Moving { speed: f32 },\n}\nlet $name$ = $Type$::Moving { speed: $rate$ };',
      'fn load_$name$(path: &str) -> Result<String, std::io::Error> {\n    let text = std::fs::read_to_string(path)?;\n    Ok(text)\n}'
    ],
    graphics: [
      'fn move_$name$(position: &mut Vec2, velocity: Vec2, dt: f32) {\n    *position += velocity * dt;\n}\nlet speed = $rate$_f32;',
      'commands.spawn(SpriteBundle {\n    sprite: Sprite {\n        custom_size: Some(Vec2::new($value$.0, $count$.0)),\n        ..default()\n    },\n    ..default()\n});',
      'for (mut transform, velocity) in query.iter_mut() {\n    transform.translation.x += velocity.x * time.delta_seconds() * $rate$;\n    transform.translation.y += velocity.y * time.delta_seconds() * $rate$;\n}',
      'let $name$ = Color::srgb($rate$, 0.7, 0.4);\nlet clear = ClearColor($name$);\napp.insert_resource(clear);'
    ],
    systems: [
      'let mut $name$ = Vec::with_capacity($limit$);\nfor value in 0..$count$ {\n    $name$.push(value * $value$);\n}',
      'let $name$ = std::thread::spawn(|| {\n    ($value$..$limit$).sum::<i32>()\n});\nlet total = $name$.join().unwrap();',
      'let (tx, rx) = std::sync::mpsc::channel();\ntx.send("$tag$").unwrap();\nlet $name$ = rx.recv().unwrap();',
      'use std::collections::HashMap;\nlet mut $name$ = HashMap::new();\n$name$.insert($value$, "$tag$");\nlet value = $name$.get(&$value$);'
    ]
  },
  go: {
    syntax: [
      '$name$ := $value$\nif $name$ > $limit$ {\n    $name$ -= $count$\n}',
      'func sum$Type$(values []int) int {\n    total := 0\n    for _, value := range values {\n        total += value\n    }\n    return total\n}',
      'for $name$ := 0; $name$ < $count$; $name$++ {\n    fmt.Println("$tag$", $name$)\n}',
      '$name$ := map[string]int{\n    "$tag$": $value$,\n    "limit": $limit$,\n}\nfmt.Println($name$["$tag$"])'
    ],
    design: [
      'type $Type$ struct {\n    ID   int\n    Name string\n}\n$name$ := $Type${ID: $value$, Name: "$tag$"}',
      'type $Type$ interface {\n    Save(ctx context.Context, key string) error\n}\nfunc persist(ctx context.Context, store $Type$) error {\n    return store.Save(ctx, "$tag$")\n}',
      'func New$Type$(capacity int) *$Type$ {\n    return &$Type${items: make([]int, 0, capacity)}\n}\n$name$ := New$Type$($count$)',
      'func (s *$Type$) Add(value int) {\n    s.items = append(s.items, value)\n}\n$name$.Add($value$)'
    ],
    graphics: [
      'func (g *Game) Draw(screen *ebiten.Image) {\n    op := &ebiten.DrawImageOptions{}\n    op.GeoM.Translate($value$, $count$)\n    screen.DrawImage(g.$name$, op)\n}',
      'type $Type$ struct {\n    X, Y float64\n}\nfunc (p *$Type$) Move(dt float64) {\n    p.X += $rate$ * dt\n}',
      'func update$Type$(positions []Point, dt float64) {\n    for i := range positions {\n        positions[i].X += $rate$ * dt\n    }\n}',
      '$name$ := color.RGBA{R: $value$, G: $count$, B: 120, A: 255}\nscreen.Fill($name$)'
    ],
    systems: [
      '$name$ := make(chan int, $count$)\ngo func() {\n    defer close($name$)\n    $name$ <- $value$\n}()\nfmt.Println(<-$name$)',
      'ctx, cancel := context.WithTimeout(context.Background(), $count$*time.Second)\ndefer cancel()\nresult, err := fetch(ctx, "$tag$")\nif err != nil { return err }',
      'http.HandleFunc("/$tag$", func(w http.ResponseWriter, r *http.Request) {\n    w.Header().Set("Content-Type", "text/plain")\n    fmt.Fprint(w, "$name$")\n})',
      'var $name$ sync.WaitGroup\n$name$.Add($count$)\nfor i := 0; i < $count$; i++ {\n    go func() { defer $name$.Done(); work() }()\n}\n$name$.Wait()'
    ]
  },
  python: {
    syntax: [
      '$name$ = $value$\nif $name$ > $limit$:\n    $name$ -= $count$',
      'def sum_$name$(values: list[int]) -> int:\n    total = 0\n    for value in values:\n        total += value\n    return total',
      '$name$ = [value * $count$ for value in range($limit$)]\nprint($name$[:$value$])',
      'for index, $name$ in enumerate(["$tag$", "backup"]):\n    print(f"{index}: {$name$}")'
    ],
    design: [
      '@dataclass\nclass $Type$:\n    id: int\n    name: str\n\n$name$ = $Type$($value$, "$tag$")',
      'class $Type$:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n        self.items = []\n\n$name$ = $Type$($count$)',
      'def load_$name$(path: str) -> dict:\n    with open(path, encoding="utf-8") as stream:\n        return json.load(stream)',
      'class $Type$(Protocol):\n    def save(self, key: str, value: bytes) -> None: ...\n\ndef persist(store: $Type$) -> None:\n    store.save("$tag$", b"$name$")'
    ],
    graphics: [
      '$name$ = pygame.Rect($value$, $count$, 16, 16)\npygame.draw.rect(screen, (80, 200, 120), $name$)\npygame.display.flip()',
      'for $name$ in particles:\n    $name$.x += $name$.vx * dt\n    $name$.y += $name$.vy * dt\n    $name$.life -= dt',
      'def draw_$name$(surface, position):\n    x, y = position\n    pygame.draw.circle(surface, (120, 180, 90), (x, y), $count$)',
      '$name$ = Image.open("$tag$.png").convert("RGBA")\n$name$ = $name$.resize(($value$, $count$))\n$name$.save("preview_$tag$.png")'
    ],
    systems: [
      'with ThreadPoolExecutor(max_workers=$count$) as pool:\n    $name$ = list(pool.map(process, records))\nprint(len($name$))',
      'async def fetch_$name$(client, path):\n    async with client.get(path) as response:\n        response.raise_for_status()\n        return await response.json()',
      'with sqlite3.connect("$tag$.db") as connection:\n    rows = connection.execute(\n        "SELECT name FROM players WHERE score > ?", ($value$,)\n    ).fetchall()',
      '@lru_cache(maxsize=$limit$)\ndef lookup_$name$(key: str) -> str:\n    return read_record("$tag$", key)'
    ]
  },
  java: {
    syntax: [
      'int $name$ = $value$;\nif ($name$ > $limit$) {\n    $name$ -= $count$;\n}\nSystem.out.println($name$);',
      'static int sum$Type$(int[] values) {\n    int total = 0;\n    for (int value : values) {\n        total += value;\n    }\n    return total;\n}',
      'String $name$ = "$tag$";\nfor (int i = 0; i < $count$; i++) {\n    System.out.println($name$ + i);\n}',
      'var $name$ = List.of($value$, $count$, $limit$);\nvar result = $name$.stream()\n    .filter(value -> value > $count$)\n    .toList();'
    ],
    design: [
      'public record $Type$(int id, String name) { }\nvar $name$ = new $Type$($value$, "$tag$");',
      'public interface $Type$ {\n    void save(String key);\n}\npublic void persist($Type$ store) {\n    store.save("$tag$");\n}',
      'public final class $Type$ {\n    private final int capacity;\n    public $Type$(int capacity) {\n        this.capacity = capacity;\n    }\n}',
      'public Optional<$Type$> find$Type$(int id) {\n    return items.stream()\n        .filter(item -> item.id() == id)\n        .findFirst();\n}'
    ],
    graphics: [
      'void draw$Type$(Graphics2D g) {\n    g.setColor(new Color(80, 200, 120));\n    g.fillRect($value$, $count$, 16, 16);\n}',
      'float $name$ = $rate$f;\nfor (Particle particle : particles) {\n    particle.x += particle.vx * $name$;\n    particle.y += particle.vy * $name$;\n}',
      'var $name$ = new BufferedImage($value$, $count$, BufferedImage.TYPE_INT_ARGB);\nvar graphics = $name$.createGraphics();\ngraphics.drawString("$tag$", 10, 20);\ngraphics.dispose();',
      'camera.position.set($value$, $count$, 0);\ncamera.update();\nbatch.setProjectionMatrix(camera.combined);\nbatch.draw($name$, 0, 0);'
    ],
    systems: [
      'var $name$ = new ConcurrentHashMap<Integer, String>();\n$name$.putIfAbsent($value$, "$tag$");\nvar result = $name$.get($value$);',
      'try (var $name$ = Files.newBufferedReader(Path.of("$tag$.txt"))) {\n    String line;\n    while ((line = $name$.readLine()) != null) {\n        System.out.println(line);\n    }\n}',
      'var $name$ = CompletableFuture.supplyAsync(() -> load("$tag$"));\n$name$.thenAccept(result -> save(result));\n$name$.join();',
      'var $name$ = Executors.newFixedThreadPool($count$);\ntry {\n    $name$.submit(() -> process($value$));\n} finally {\n    $name$.shutdown();\n}'
    ]
  },
  sql: {
    syntax: [
      'SELECT id, name, score\nFROM players\nWHERE score >= $value$\nORDER BY score DESC\nLIMIT $count$;',
      'INSERT INTO items (id, name, price)\nVALUES ($value$, \'$tag$\', $limit$);',
      'UPDATE inventory\nSET quantity = quantity + $count$\nWHERE item_id = $value$\n  AND owner_name = \'$tag$\';',
      'SELECT category, COUNT(*) AS $name$\nFROM items\nGROUP BY category\nHAVING COUNT(*) > $count$;'
    ],
    design: [
      'CREATE TABLE $name$ (\n    id INTEGER PRIMARY KEY,\n    name VARCHAR($limit$) NOT NULL,\n    score INTEGER DEFAULT $value$\n);',
      'CREATE TABLE $name$ (\n    player_id INTEGER NOT NULL,\n    item_id INTEGER NOT NULL,\n    quantity INTEGER DEFAULT $count$,\n    PRIMARY KEY (player_id, item_id)\n);',
      'SELECT p.name, SUM(o.amount) AS $name$\nFROM players AS p\nJOIN orders AS o ON o.player_id = p.id\nWHERE o.amount > $value$\nGROUP BY p.id, p.name;',
      'WITH $name$ AS (\n    SELECT player_id, COUNT(*) AS total\n    FROM sessions\n    GROUP BY player_id\n)\nSELECT * FROM $name$ WHERE total >= $count$;'
    ],
    graphics: [
      'SELECT sprite_id, x, y, layer\nFROM entities\nWHERE scene_name = \'$tag$\'\nORDER BY layer ASC\nLIMIT $count$;',
      'SELECT asset_name, width, height\nFROM textures\nWHERE width <= $limit$\n  AND height <= $value$\nORDER BY asset_name;',
      'SELECT frame_id, duration_ms\nFROM animation_frames\nWHERE animation_name = \'$tag$\'\nORDER BY frame_id\nLIMIT $count$;',
      'SELECT x / $count$ AS cell_x, y / $count$ AS cell_y, COUNT(*)\nFROM particles\nWHERE life > $rate$\nGROUP BY cell_x, cell_y;'
    ],
    systems: [
      'CREATE INDEX idx_$name$_score\nON players (score DESC, id)\nWHERE score >= $value$;',
      'BEGIN;\nUPDATE wallets SET balance = balance - $value$ WHERE id = $count$;\nINSERT INTO receipts (wallet_id, label) VALUES ($count$, \'$tag$\');\nCOMMIT;',
      'SELECT player_id, score,\n    RANK() OVER (ORDER BY score DESC) AS $name$\nFROM leaderboard\nWHERE season_id = $value$;',
      'EXPLAIN SELECT p.id, p.name\nFROM players AS p\nWHERE EXISTS (\n    SELECT 1 FROM sessions AS s\n    WHERE s.player_id = p.id AND s.duration > $limit$\n);'
    ]
  },
  lua: {
    syntax: [
      'local $name$ = $value$\nif $name$ > $limit$ then\n    $name$ = $name$ - $count$\nend',
      'local function sum_$name$(values)\n    local total = 0\n    for _, value in ipairs(values) do\n        total = total + value\n    end\n    return total\nend',
      'local $name$ = { name = "$tag$", score = $value$ }\nfor key, value in pairs($name$) do\n    print(key, value)\nend',
      'for $name$ = 1, $count$ do\n    if $name$ % 2 == 0 then\n        print("$tag$", $name$)\n    end\nend'
    ],
    design: [
      'local $Type$ = {}\n$Type$.__index = $Type$\nfunction $Type$.new(value)\n    return setmetatable({ value = value }, $Type$)\nend\nlocal $name$ = $Type$.new($value$)',
      'local $name$ = {}\nfunction $name$.update(dt)\n    world:update(dt)\nend\nreturn $name$',
      'local function create_$name$(capacity)\n    local items = {}\n    return {\n        add = function(value) items[#items + 1] = value end,\n        size = function() return #items end\n    }\nend',
      'local handlers = {}\nhandlers["$tag$"] = function(event)\n    player.score = player.score + $value$\nend\nhandlers["$tag$"]({ id = $count$ })'
    ],
    graphics: [
      'function love.draw()\n    love.graphics.setColor(0.3, 0.8, $rate$)\n    love.graphics.rectangle("fill", $value$, $count$, 16, 16)\nend',
      'function love.update(dt)\n    $name$.x = $name$.x + $rate$ * dt\n    $name$.y = $name$.y + gravity * dt\nend',
      'local $name$ = love.graphics.newImage("$tag$.png")\nlove.graphics.draw($name$, $value$, $count$, 0, 2, 2)',
      'for _, particle in ipairs($name$) do\n    love.graphics.setColor(1, 1, 1, particle.life)\n    love.graphics.circle("fill", particle.x, particle.y, $count$)\nend'
    ],
    systems: [
      'local $name$ = coroutine.create(function()\n    for i = 1, $count$ do\n        coroutine.yield(i * $value$)\n    end\nend)\ncoroutine.resume($name$)',
      'local ok, result = pcall(function()\n    return load_asset("$tag$")\nend)\nif not ok then\n    print(result)\nend',
      'local $name$ = setmetatable({}, { __mode = "v" })\n$name$["$tag$"] = load_resource($value$)\ncollectgarbage("step", $count$)',
      'local $name$ = {}\nfor i = 1, $count$ do\n    $name$[i] = { active = false, x = $value$, y = 0 }\nend\nreturn $name$'
    ]
  }
};

export const SUBJECT_IDS = ['syntax', 'design', 'graphics', 'systems'];
export const TEMPLATE_COUNT = Object.values(DATA).reduce((n, topics) => n + Object.values(topics).reduce((m, pool) => m + pool.length, 0), 0);
export const PROMPT_COUNT = TEMPLATE_COUNT * VARIANTS;
export function promptAt(language, subject, index) {
  language = DATA[language] ? language : 'cpp';
  subject = SUBJECT_IDS.includes(subject) ? subject : 'syntax';
  const pool = DATA[language][subject];
  const number = Math.max(0, Math.floor(index)) % (pool.length * VARIANTS);
  const variant = Math.floor(number / pool.length);
  const names = ['player', 'enemy', 'score', 'inventory', 'scene', 'session', 'account', 'record', 'cache', 'worker', 'result', 'buffer', 'packet', 'ticket', 'asset', 'shipment'];
  const name = names[variant];
  const data = { name, Type: name[0].toUpperCase() + name.slice(1), value: String(12 + variant * 7), count: String(3 + variant), limit: String(128 + variant * 16), rate: (0.1 + variant * 0.03).toFixed(2), tag: `build_${variant + 1}` };
  return pool[number % pool.length].replace(/\$(\w+)\$/g, (_, key) => data[key]);
}
export function createTypingState() {
  return { language: 'cpp', index: 0, offset: 0, context: '', errors: 0, correct: 0, completed: 0, roundErrors: 0, bonusBase: 0 };
}
export function normalizeTypingState(value) {
  const s = createTypingState();
  if (!value || typeof value !== 'object') return s;
  if (LANGUAGES.some(l => l.id === value.language)) s.language = value.language;
  for (const key of ['index', 'offset', 'errors', 'correct', 'completed', 'roundErrors']) if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] < 1e12) s[key] = value[key];
  s.offset = Math.min(2000, s.offset);
  if (typeof value.context === 'string' && /^[a-z]+\/[a-z]+\/\d+$/.test(value.context)) s.context = value.context;
  if (Number.isFinite(value.bonusBase) && value.bonusBase >= 0) s.bonusBase = Math.min(1e250, value.bonusBase);
  return s;
}
export function typingSubject(state) {
  if (state.mode === 'study') return state.subject;
  if (state.mode === 'work') return 'office';
  return ['syntax', 'design', 'graphics', 'systems'][Math.min(3, Math.floor(state.projectIndex / 2))];
}
export function currentPrompt(state) {
  const subject = typingSubject(state);
  const context = `${state.mode}/${subject}/${state.projectIndex}`;
  if (state.typing.context !== context) {
    state.typing.context = context;
    state.typing.offset = 0;
    state.typing.roundErrors = 0;
    state.typing.bonusBase = 0;
  }
  const text = state.mode === 'work' ? officeOrderAt(state.typing.index).input : promptAt(state.typing.language, subject, state.typing.index);
  state.typing.offset = Math.min(state.typing.offset, text.length - 1);
  return text;
}
// This function accepts one actual character, never an arbitrary key or a paste.
// Economy rewards are applied by the caller only after this validation succeeds.
export function acceptCharacter(state, character, basePower = 1) {
  const text = currentPrompt(state), t = state.typing;
  if (character !== text[t.offset]) {
    t.errors++;
    t.roundErrors++;
    return { correct: false, complete: false, bonus: 0 };
  }
  t.offset++;
  t.correct++;
  t.bonusBase = Math.min(1e250, t.bonusBase + basePower);
  if (t.offset < text.length) return { correct: true, complete: false, bonus: 0 };
  const accuracy = text.length / (text.length + t.roundErrors);
  const bonus = t.bonusBase * TYPING_REWARD.completion * accuracy ** 2;
  t.completed++;
  t.index++;
  t.offset = 0;
  t.roundErrors = 0;
  t.bonusBase = 0;
  t.context = '';
  return { correct: true, complete: true, bonus, accuracy };
}
