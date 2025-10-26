import React from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState(
    localStorage.getItem('theme') || 'light'
  );

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
      {theme === 'dark' ? '🌞' : '🌜'}
    </button>
  );
}
