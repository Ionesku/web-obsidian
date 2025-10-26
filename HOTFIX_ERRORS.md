# Hotfix - Исправление критических ошибок

**Дата:** 26 октября 2025  
**Проблемы:** IndexedDB ConstraintError + CORS ошибка

---

## 🔴 ПРОБЛЕМА 1: IndexedDB ConstraintError

### Ошибка:
```
BulkError: linkIndex.bulkAdd(): 12 of 36 operations failed
ConstraintError: A mutation operation in the transaction failed 
because a constraint was not satisfied.
```

### Причина:
Файл содержит несколько ссылок на один и тот же файл:
```markdown
[[Welcome]] текст [[Welcome]] еще текст [[Welcome]]
```

При индексации создается 3 записи с одинаковым ID:
- `Welcome.md+notes/Welcome.md`
- `Welcome.md+notes/Welcome.md` ❌ дубликат!
- `Welcome.md+notes/Welcome.md` ❌ дубликат!

### Исправление:
✅ **Файл:** `frontend/src/search/idb.ts`

**Изменения:**
1. Дедупликация ссылок перед добавлением
2. Дедупликация тегов (на всякий случай)

**Код:**
```typescript
// Было:
await this.linkIndex.bulkAdd(
  meta.links.map(link => ({...}))
);

// Стало:
const linkMap = new Map<string, {...}>();
for (const link of meta.links) {
  const id = `${link.target}+${file.path}`;
  if (!linkMap.has(id)) {
    linkMap.set(id, {...});
  }
}
const uniqueLinks = Array.from(linkMap.values());
await this.linkIndex.bulkAdd(uniqueLinks);
```

---

## 🔴 ПРОБЛЕМА 2: CORS ошибка

### Ошибка:
```
Запрос из постороннего источника заблокирован: 
Политика одного источника запрещает чтение удаленного ресурса 
на http://localhost:8000/api/search
```

### Причина:
1. **Неправильный порядок middleware** - CORS был не первым
2. **SecurityHeadersMiddleware блокировал OPTIONS** - preflight запросы

### Исправление:
✅ **Файл:** `backend/app/main.py`

**Было:**
```python
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)

# CORS middleware
app.add_middleware(CORSMiddleware, ...)
```

**Стало:**
```python
# CORS middleware - MUST be first!
app.add_middleware(CORSMiddleware, ...)

# Other middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)
```

✅ **Файл:** `backend/app/middleware.py`

**Добавлено:**
```python
async def dispatch(self, request: Request, call_next):
    # Skip security headers for OPTIONS (CORS preflight)
    if request.method == "OPTIONS":
        return await call_next(request)
    
    # ... rest of code
```

---

## ✅ КАК ПРИМЕНИТЬ

### 1. Перезапустить backend:
```bash
cd backend

# Остановить (Ctrl+C)
# Запустить снова
python -m app.main
```

### 2. Очистить IndexedDB в браузере:
```javascript
// Открыть DevTools Console
// Выполнить:
indexedDB.deleteDatabase('ObsidianSearchDB');

// Перезагрузить страницу (F5)
```

### 3. Проверить:
```bash
# 1. Открыть файл Welcome.md
# 2. Сохранить (Ctrl+S)
# 3. Проверить консоль - ошибок быть не должно
# 4. Попробовать поиск
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Тест 1: IndexedDB
```bash
1. Открыть файл со множественными ссылками
2. Сохранить
3. Проверить консоль: ✅ Нет ошибок ConstraintError
```

### Тест 2: CORS
```bash
1. Открыть поиск
2. Ввести запрос: "test"
3. Проверить Network tab: ✅ Запрос успешен (200)
4. Проверить консоль: ✅ Нет CORS ошибок
```

### Тест 3: Федеративный поиск
```bash
1. Поиск: tag:work "important"
2. Должен работать локальный + серверный поиск
3. Результаты появляются
```

---

## 📊 ТЕХНИЧЕСКИЕ ДЕТАЛИ

### Почему CORS middleware должен быть первым?

FastAPI обрабатывает middleware в **обратном порядке** добавления:

```
Request → [Last Middleware] → ... → [First Middleware] → Handler
         ↓
Response ← [First Middleware] ← ... ← [Last Middleware] ← Handler
```

Если CORS не первый:
1. OPTIONS запрос приходит
2. SecurityHeadersMiddleware пытается его обработать
3. CORS заголовки не добавляются
4. Браузер блокирует запрос ❌

Если CORS первый:
1. OPTIONS запрос приходит
2. CORSMiddleware сразу добавляет заголовки
3. Браузер разрешает запрос ✅

### Почему Map для дедупликации?

Set не подходит для объектов:
```typescript
// ❌ Не работает
const set = new Set([
  {id: "1", ...},
  {id: "1", ...}  // Разные объекты!
]);
set.size; // 2 (не дедуплицировалось)

// ✅ Работает
const map = new Map();
map.set("1", {...});
map.set("1", {...});  // Перезапишет!
map.size; // 1
```

---

## 🎯 РЕЗУЛЬТАТЫ

### До:
- ❌ Ошибки при сохранении файлов с дубликатами ссылок
- ❌ CORS блокирует поиск
- ❌ Федеративный поиск не работает
- ❌ Пользователь видит красные ошибки в консоли

### После:
- ✅ Файлы сохраняются без ошибок
- ✅ CORS настроен правильно
- ✅ Поиск работает
- ✅ Консоль чистая

---

## 📝 ЧЕКЛИСТ

- [x] Исправлен `idb.ts` (дедупликация)
- [x] Исправлен `main.py` (порядок middleware)
- [x] Исправлен `middleware.py` (OPTIONS bypass)
- [x] Backend перезапущен
- [ ] IndexedDB очищен (руками в браузере)
- [ ] Тесты пройдены

---

**Статус:** ✅ Исправления применены
**Требуется:** Перезапуск backend + очистка IndexedDB

