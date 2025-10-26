# Подсветка синтаксиса кода

## Обзор

В редакторе Markdown теперь полностью поддерживается подсветка синтаксиса для кодовых блоков. Система автоматически определяет язык программирования и применяет соответствующую подсветку.

## Поддерживаемые языки

### JavaScript & TypeScript
- **Алиасы**: `js`, `javascript`, `node`, `jsx`
- **Алиасы (TS)**: `ts`, `typescript`, `tsx`

```javascript
function example() {
  console.log("Hello, World!");
}
```

### Python
- **Алиасы**: `py`, `python`, `python3`, `py3`

```python
def fibonacci(n):
    return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)
```

### Java
- **Алиасы**: `java`

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

### C/C++
- **Алиасы**: `cpp`, `c++`, `cxx`, `cc`, `c`, `h`, `hpp`

```cpp
#include <iostream>
int main() {
    std::cout << "Hello, C++!" << std::endl;
    return 0;
}
```

### Rust
- **Алиасы**: `rust`, `rs`

```rust
fn main() {
    println!("Hello, Rust!");
}
```

### PHP
- **Алиасы**: `php`, `php3`, `php4`, `php5`

```php
<?php
echo "Hello, PHP!";
?>
```

### SQL
- **Алиасы**: `sql`, `mysql`, `postgresql`, `postgres`, `sqlite`, `plsql`

```sql
SELECT * FROM users WHERE active = true;
```

### HTML & Template Languages
- **Алиасы**: `html`, `htm`, `xhtml`, `jinja`, `jinja2`, `django`, `twig`, `handlebars`, `hbs`, `mustache`

Jinja2 и другие шаблонные языки используют подсветку HTML:

```jinja
{% for item in items %}
  <p>{{ item.name }}</p>
{% endfor %}
```

### CSS & Препроцессоры
- **Алиасы**: `css`, `scss`, `sass`, `less`, `stylus`

```css
.container {
    display: flex;
    justify-content: center;
}
```

### JSON
- **Алиасы**: `json`, `jsonc`, `json5`

```json
{
  "name": "example",
  "version": "1.0.0"
}
```

### XML
- **Алиасы**: `xml`, `svg`, `rss`, `atom`

```xml
<?xml version="1.0"?>
<root>
  <item>Value</item>
</root>
```

### YAML
- **Алиасы**: `yaml`, `yml`

```yaml
name: example
version: 1.0.0
dependencies:
  - package1
  - package2
```

### Bash/Shell
- **Алиасы**: `bash`, `sh`, `shell`

```bash
#!/bin/bash
echo "Hello, Shell!"
```

## Использование

### Базовый синтаксис

Для применения подсветки синтаксиса используйте тройные обратные кавычки с указанием языка:

\`\`\`язык
ваш код здесь
\`\`\`

### Примеры

**Python:**
\`\`\`python
def greet(name):
    print(f"Hello, {name}!")
\`\`\`

**JavaScript:**
\`\`\`javascript
const greet = (name) => {
    console.log(\`Hello, \${name}!\`);
};
\`\`\`

**TypeScript:**
\`\`\`typescript
function greet(name: string): void {
    console.log(\`Hello, \${name}!\`);
}
\`\`\`

## Технические детали

### Архитектура

1. **Модуль языков** (`code-languages.ts`): Управляет всеми поддерживаемыми языками и их алиасами
2. **Интеграция CodeMirror**: Markdown редактор автоматически применяет подсветку через параметр `codeLanguages`
3. **Динамическая загрузка**: Языковая поддержка загружается по требованию для оптимизации производительности

### Установленные пакеты

```json
{
  "@codemirror/lang-javascript": "^6.x",
  "@codemirror/lang-python": "^6.x",
  "@codemirror/lang-java": "^6.x",
  "@codemirror/lang-cpp": "^6.x",
  "@codemirror/lang-rust": "^6.x",
  "@codemirror/lang-php": "^6.x",
  "@codemirror/lang-sql": "^6.x",
  "@codemirror/lang-html": "^6.x",
  "@codemirror/lang-css": "^6.x",
  "@codemirror/lang-json": "^6.x",
  "@codemirror/lang-xml": "^6.x",
  "@codemirror/lang-yaml": "^6.x"
}
```

## Добавление новых языков

Чтобы добавить поддержку нового языка:

1. **Установите пакет:**
   ```bash
   npm install @codemirror/lang-<язык>
   ```

2. **Добавьте в `code-languages.ts`:**
   ```typescript
   import { newlang } from '@codemirror/lang-newlang';
   
   // В массив languages добавьте:
   {
     name: 'newlang',
     aliases: ['newlang', 'nl'],
     support: () => newlang(),
   }
   ```

3. Перезапустите приложение - подсветка заработает автоматически!

## Тестирование

Для тестирования подсветки откройте файл **"Code Highlighting Test.md"** в хранилище. Он содержит примеры кода на всех поддерживаемых языках.

## Производительность

- **Оптимизация**: Языковые парсеры загружаются только при необходимости
- **Кэширование**: CodeMirror кэширует результаты парсинга для быстрой работы
- **Масштабируемость**: Система поддерживает файлы любого размера без потери производительности

## Возможные проблемы

### Подсветка не работает

1. Проверьте правильность написания языка в блоке кода
2. Убедитесь, что язык поддерживается (см. список выше)
3. Проверьте консоль браузера на наличие ошибок

### Неправильная подсветка

1. Используйте правильный алиас языка
2. Для шаблонов (Jinja, Django) используйте алиас `jinja` или `django`

### Добавить поддержку нового языка

Создайте issue или pull request в репозитории проекта с описанием требуемого языка.

## Связанные файлы

- `frontend/src/lib/codemirror/code-languages.ts` - Конфигурация языков
- `frontend/src/components/markdown-editor.tsx` - Интеграция с редактором
- `data/vaults/user_1/notes/Code Highlighting Test.md` - Тестовый файл

---

**Статус**: ✅ Полностью реализовано и протестировано

**Версия**: 1.0.0

**Дата**: 26 октября 2025

