# Advanced Search System

Двухслойная система поиска для быстрого поиска в заметках, вдохновленная Obsidian.

## Архитектура

### Слой A (Локальный - IndexedDB)
- **Технология**: IndexedDB с Dexie.js, Web Worker для парсинга
- **Что ищет**: Метаданные (теги, свойства, заголовки, ссылки, блоки, задачи)
- **Скорость**: Мгновенно (< 50ms)
- **Где**: Браузер пользователя

### Слой B (Серверный - Whoosh)
- **Технология**: Whoosh (Python full-text search)
- **Что ищет**: Полнотекстовый поиск, фразы, regex
- **Скорость**: Быстро (< 200ms)
- **Где**: Backend сервер

### Федерация
Парсер запросов разбивает запрос на локальную и серверную части, исполняет их параллельно и объединяет результаты.

## Синтаксис поиска

### Базовые операторы

```
слово                    # Простой поиск слова
"точная фраза"           # Поиск фразы
/regex/i                 # Regex с флагами
-слово                   # Исключить слово
слово1 OR слово2         # Логическое ИЛИ (по умолчанию И)
(слово1 OR слово2) -слово3  # Группировка
```

### Локальные операторы (Слой A)

```
tag:work                 # Файлы с тегом #work
tag:work/project         # Иерархические теги
tag:work*                # Все теги начинающиеся с work

file:today               # Поиск по имени файла
path:notes/              # Поиск по пути

[status:todo]            # Свойство equals
[priority:high]          # 
[count>=10]              # Численные сравнения
[date>2024-01-01]        # Сравнение дат

block:^abc123            # Поиск блока по ID
section:"Header"         # Поиск секции по заголовку

task:                    # Все задачи
task:done                # Только выполненные
task:todo                # Только невыполненные

link:[[note]]            # Файлы, ссылающиеся на note
backlink:[[note]]        # Файлы, на которые ссылается note
```

### Серверные операторы (Слой B)

```
слово                    # Полнотекстовый поиск
"точная фраза"           # Поиск фразы в тексте
/TODO:\s+\w+/i           # Regex поиск

line:/pattern/           # Поиск паттерна в строке
```

### Комбинированные запросы

```
# Локальный фильтр + серверный поиск
tag:work "important project"

# Несколько условий
tag:work [status:todo] "deadline"

# Сложная логика
(tag:work OR tag:personal) -tag:archive "meeting notes"

# Иерархический поиск
path:projects/ tag:active [priority>=2] "review"
```

## Примеры использования

### Поиск задач
```
# Все незавершенные задачи в проекте work
tag:work task:todo

# Высокоприоритетные задачи
task:todo [priority:high]

# Задачи с дедлайном
task:todo /deadline:.*2024/
```

### Поиск по связям
```
# Все файлы, ссылающиеся на Research.md
link:[[Research]]

# Все файлы, на которые ссылается Index.md
backlink:[[Index]]

# Файлы без обратных ссылок (orphans)
-backlink:*
```

### Комплексный поиск
```
# Рабочие заметки с встречами за последний месяц
tag:work "meeting" [date>=2024-10-01]

# Незавершенные задачи в активных проектах
tag:projects/active task:todo -tag:done

# Все markdown файлы с code blocks Python
file:*.md /```python/
```

## API

### Frontend (React)

```typescript
import { useSearch } from '@/hooks/useSearch';

function SearchComponent() {
  const { search, result, isSearching } = useSearch();
  
  const handleSearch = (query: string) => {
    search(query, { limit: 50 });
  };
  
  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {result?.hits.map(hit => (
        <div key={hit.path}>{hit.title}</div>
      ))}
    </div>
  );
}
```

### Backend (FastAPI)

```python
from app.search import get_indexer

# Index a file
indexer = get_indexer()
indexer.upsert_document(
    path="notes/work.md",
    content="# Work Notes\n...",
    name="work.md",
    tags=["work", "important"],
    props={"status": "active"}
)

# Search
POST /api/search
{
  "terms": [
    {"type": "word", "value": "important"},
    {"type": "phrase", "value": "meeting notes"}
  ],
  "restrict_paths": ["notes/work.md", "notes/project.md"],
  "limit": 50
}
```

## Производительность

### Локальный слой (A)
- **Индексация**: ~1000 файлов/сек в фоне
- **Поиск**: < 50ms для большинства запросов
- **Хранилище**: ~1-5 MB на 1000 файлов

### Серверный слой (B)
- **Индексация**: ~500 файлов/сек
- **Поиск**: < 200ms для полнотекстовых запросов
- **Хранилище**: ~10-50 MB на 1000 файлов

### Оптимизации
1. **Дедупликация**: Файлы не переиндексируются без изменений (по hash)
2. **Батчинг**: Индексация группами по 50 файлов
3. **Web Worker**: Парсинг не блокирует UI
4. **Префильтрация**: Локальный слой фильтрует файлы перед серверным поиском

## Мониторинг

```typescript
// Frontend stats
const stats = await searchEngine.getStats();
console.log(stats);
// { files: 1234, tags: 567, links: 890, ... }

// Backend stats
GET /api/search/stats
// { doc_count: 1234, version: 42, index_dir: "/data/whoosh" }
```

## Отладка

### Explain query
```typescript
import { explainSearch } from '@/search/parser/federation';

const explanation = await explainSearch('tag:work "important"');
console.log(explanation);
```

Результат:
```
Query Plan:

Local (Layer A):
  tag:work

Server (Layer B):
  "important"

Restrict to 15 file(s) from local filtering

Strategy: Query uses both local filters and server search
```

## Интеграция

### Автоматическая индексация

Файлы автоматически индексируются при сохранении в редакторе:

```typescript
// В markdown-editor.tsx
import { searchEngine } from '@/search/engine';

const handleSave = async (content: string) => {
  await api.saveFile(path, content);
  
  // Автоматическая индексация
  await searchEngine.indexLocal({
    path,
    content,
    mtime: Date.now(),
    hash: '',
  });
};
```

### Manual reindex

```typescript
// Полная переиндексация
await searchEngine.clearIndex();

// Batch index
const files = await api.getAllFiles();
await searchEngine.indexBatch(
  files.map(f => ({
    path: f.path,
    content: f.content,
    mtime: f.mtime,
    hash: '',
  }))
);

// Rebuild backlinks graph
await searchEngine.rebuildGraph();
```

## Расширение системы

### Добавление нового оператора

1. **Добавить тип в `types.ts`**:
```typescript
export type Term = 
  | ... 
  | { kind: 'author'; value: string };  // Новый оператор
```

2. **Парсинг в `query-parse.ts`**:
```typescript
case 'author':
  return { kind: 'author', value };
```

3. **Классификация в `query-plan.ts`**:
```typescript
case 'author':
  return 'local';  // или 'server'
```

4. **Исполнение в `execute-local.ts`**:
```typescript
case 'author':
  return await db.pathsByAuthor(term.value);
```

5. **Добавить индекс в `idb.ts`** (если нужно)

### Замена Whoosh на другой движок

Благодаря абстракции `SearchEngine`, можно легко заменить Whoosh на:
- **Meilisearch**: Более быстрый, typo-tolerant
- **Typesense**: Моментальный поиск, лучше для больших объемов
- **Tantivy** (Rust): Максимальная производительность

Нужно только реализовать серверный API с тем же интерфейсом:
```
POST /api/search
{
  "terms": [...],
  "restrict_paths": [...],
  "limit": 50
}
```

## Безопасность

1. **Изоляция пользователей**: Каждый пользователь видит только свои файлы
2. **Аутентификация**: Все endpoints требуют Bearer token
3. **Path validation**: Проверка путей на сервере
4. **Rate limiting**: Ограничение количества запросов

## Дальнейшее развитие (M3+)

- [ ] Fuzzy search (опечатки)
- [ ] Морфологический анализ (русский язык)
- [ ] Semantic search (embeddings)
- [ ] Search history с предложениями
- [ ] Сохраненные поисковые запросы
- [ ] Export результатов
- [ ] Search API webhooks
- [ ] Full-text highlighting в preview
- [ ] Search performance metrics

## Troubleshooting

### Файлы не индексируются

1. Проверить Web Worker:
```typescript
console.log(searchEngine.getStatus());
```

2. Проверить IndexedDB:
```typescript
const stats = await db.getStats();
console.log(stats);
```

3. Проверить консоль браузера на ошибки

### Медленный поиск

1. Проверить размер индекса:
```typescript
const stats = await db.getStats();
// Если files > 10000, может быть медленно
```

2. Оптимизировать запрос (избегать regex без префикса)
3. Использовать локальные операторы для фильтрации

### Серверный поиск не работает

1. Проверить backend logs: `docker-compose logs backend`
2. Проверить Whoosh индекс: `GET /api/search/stats`
3. Проверить сетевые запросы в DevTools

## Лицензия

MIT License - см. главный README проекта

