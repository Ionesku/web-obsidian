# Тест подсветки синтаксиса кода

Этот файл демонстрирует поддержку подсветки синтаксиса для различных языков программирования.

## JavaScript

```javascript
function greet(name) {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}

greet('World');
```

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User | null {
  const user: User = {
    id,
    name: 'John Doe',
    email: 'john@example.com',
  };
  return user;
}
```

## Python

```python
def fibonacci(n):
    """Вычисляет число Фибоначчи"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Примеры использования
for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")
```

## Jinja2 (HTML Templates)

```jinja
<!DOCTYPE html>
<html>
<head>
    <title>{{ title }}</title>
</head>
<body>
    <h1>Welcome {{ user.name }}!</h1>
    
    {% if user.is_admin %}
        <p>You have admin privileges</p>
    {% endif %}
    
    <ul>
    {% for item in items %}
        <li>{{ item.name }}: ${{ item.price }}</li>
    {% endfor %}
    </ul>
</body>
</html>
```

## SQL

```sql
-- Создание таблицы пользователей
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Выборка данных
SELECT 
    u.username,
    COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id
ORDER BY post_count DESC
LIMIT 10;
```

## Rust

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    
    let sum: i32 = numbers.iter()
        .filter(|&n| n % 2 == 0)
        .map(|&n| n * 2)
        .sum();
    
    println!("Sum of even numbers doubled: {}", sum);
}

#[derive(Debug)]
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn distance(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}
```

## Java

```java
public class Calculator {
    private double result;
    
    public Calculator() {
        this.result = 0.0;
    }
    
    public Calculator add(double value) {
        result += value;
        return this;
    }
    
    public Calculator multiply(double value) {
        result *= value;
        return this;
    }
    
    public double getResult() {
        return result;
    }
    
    public static void main(String[] args) {
        Calculator calc = new Calculator();
        double result = calc.add(5).multiply(2).add(3).getResult();
        System.out.println("Result: " + result);
    }
}
```

## C++

```cpp
#include <iostream>
#include <vector>
#include <algorithm>

template<typename T>
class Stack {
private:
    std::vector<T> elements;
    
public:
    void push(const T& elem) {
        elements.push_back(elem);
    }
    
    T pop() {
        if (elements.empty()) {
            throw std::runtime_error("Stack is empty");
        }
        T elem = elements.back();
        elements.pop_back();
        return elem;
    }
    
    bool isEmpty() const {
        return elements.empty();
    }
};

int main() {
    Stack<int> stack;
    stack.push(10);
    stack.push(20);
    std::cout << stack.pop() << std::endl;
    return 0;
}
```

## PHP

```php
<?php
class User {
    private $name;
    private $email;
    
    public function __construct($name, $email) {
        $this->name = $name;
        $this->email = $email;
    }
    
    public function greet() {
        return "Hello, my name is {$this->name}";
    }
    
    public function sendEmail($message) {
        mail($this->email, "Message", $message);
    }
}

$user = new User("John", "john@example.com");
echo $user->greet();
?>
```

## CSS

```css
/* Современные CSS переменные и Grid */
:root {
    --primary-color: #3b82f6;
    --secondary-color: #10b981;
    --spacing: 1rem;
}

.container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing);
    padding: var(--spacing);
}

.card {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.card:hover {
    transform: translateY(-4px);
}
```

## JSON

```json
{
  "name": "obsidian-web",
  "version": "1.0.0",
  "dependencies": {
    "@codemirror/view": "^6.23.0",
    "react": "^18.3.1"
  },
  "config": {
    "port": 3000,
    "features": {
      "search": true,
      "canvas": true,
      "vim": false
    }
  },
  "authors": [
    {
      "name": "Developer",
      "email": "dev@example.com"
    }
  ]
}
```

## YAML

```yaml
# Docker Compose конфигурация
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/obsidian
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    
  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secretpass
      POSTGRES_DB: obsidian

volumes:
  pgdata:
```

## XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
    <book category="programming">
        <title lang="en">Clean Code</title>
        <author>Robert C. Martin</author>
        <year>2008</year>
        <price currency="USD">42.95</price>
        <description>
            A handbook of agile software craftsmanship
        </description>
    </book>
    <book category="web">
        <title lang="en">JavaScript: The Good Parts</title>
        <author>Douglas Crockford</author>
        <year>2008</year>
        <price currency="USD">29.99</price>
    </book>
</bookstore>
```

## Bash/Shell

```bash
#!/bin/bash

# Скрипт для резервного копирования
BACKUP_DIR="/backup"
SOURCE_DIR="/data"
DATE=$(date +%Y-%m-%d)

# Функция для логирования
log() {
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $1"
}

# Создание резервной копии
log "Starting backup..."
tar -czf "${BACKUP_DIR}/backup-${DATE}.tar.gz" "${SOURCE_DIR}"

if [ $? -eq 0 ]; then
    log "Backup completed successfully"
else
    log "Backup failed!"
    exit 1
fi

# Удаление старых копий (старше 7 дней)
find "${BACKUP_DIR}" -name "backup-*.tar.gz" -mtime +7 -delete
log "Old backups cleaned up"
```

---

#programming #syntax-highlighting #testing #codemirror

