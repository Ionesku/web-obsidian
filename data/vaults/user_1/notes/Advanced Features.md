# Advanced Features

## Transclusion (Embedding)
You can embed content from other notes using `![[note]]` syntax.

Example: ![[Welcome]]

## Backlinks
Every note shows how many other notes link to it in the status bar. This helps you understand the connections in your knowledge base.

## Code Syntax Highlighting
We support many programming languages:

### TypeScript
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = {
  id: 1,
  name: "John Doe",
  email: "john@example.com"
};
```

### Rust
```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
```

### SQL
```sql
SELECT u.name, COUNT(n.id) as note_count
FROM users u
LEFT JOIN notes n ON u.id = n.user_id
GROUP BY u.name
ORDER BY note_count DESC;
```

## Graph View (Coming Soon)
Visualize the connections between your notes in an interactive graph.

## Vim Mode
Toggle Vim keybindings in the editor for modal editing.

## Custom Templates
Create reusable templates for:
- Meeting notes
- Project planning
- Book reviews
- Research papers

---

Related: [[Getting Started]] | [[Templates]]
Tags: #advanced #features #power-user

