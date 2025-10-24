# Contributing to Obsidian Web

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)

### Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd obsidian
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Run Backend**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

5. **Run Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

## Code Style

### Python (Backend)

- Follow PEP 8
- Use Black for formatting: `black app/`
- Use type hints
- Max line length: 100 characters
- Write docstrings for functions and classes

```python
def example_function(param: str) -> dict:
    """Short description.
    
    Args:
        param: Description of parameter
        
    Returns:
        Description of return value
    """
    return {"result": param}
```

### TypeScript (Frontend)

- Use TypeScript strict mode
- Use functional components with hooks
- Follow React best practices
- Use Prettier for formatting

```typescript
interface Props {
  title: string;
  onSave: () => void;
}

export const Component: React.FC<Props> = ({ title, onSave }) => {
  return <div>{title}</div>;
};
```

## Testing

### Backend Tests

```bash
cd backend
pytest tests/ -v
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add password reset functionality
fix(editor): resolve wikilink autocomplete issue
docs(readme): update installation instructions
```

## Pull Request Process

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write tests for new features
   - Update documentation
   - Follow code style guidelines

4. **Run tests**
   ```bash
   # Backend
   pytest tests/
   
   # Frontend
   npm test
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Describe your changes
   - Reference any related issues
   - Ensure CI/CD passes

## Feature Requests

Have an idea for a new feature?

1. Check existing issues first
2. Open a new issue with:
   - Clear description of the feature
   - Use cases
   - Potential implementation approach

## Bug Reports

Found a bug?

1. Check if it's already reported
2. Open a new issue with:
   - Description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, browser, versions)
   - Screenshots if applicable

## Code Review

All submissions require review. We aim to review PRs within 48 hours.

Reviews focus on:
- Code quality and style
- Test coverage
- Documentation
- Security considerations
- Performance impact

## Questions?

- Open a Discussion on GitHub
- Check existing documentation
- Review closed issues for similar questions

## License

By contributing, you agree that your contributions will be licensed under the project's license.

