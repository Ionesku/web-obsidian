/**
 * Template system with variable substitution
 */
import { format, getWeek } from 'date-fns';

export interface TemplateVariables {
  [key: string]: string | number;
}

/**
 * Built-in template variables
 */
export function getBuiltInVariables(customVars: TemplateVariables = {}): TemplateVariables {
  const now = new Date();
  
  return {
    // Date variables
    'date:YYYY-MM-DD': format(now, 'yyyy-MM-dd'),
    'date:YYYY': format(now, 'yyyy'),
    'date:MM': format(now, 'MM'),
    'date:DD': format(now, 'dd'),
    'date:dddd, MMMM D, YYYY': format(now, 'EEEE, MMMM d, yyyy'),
    'date:MMMM D, YYYY': format(now, 'MMMM d, yyyy'),
    'date:MMM D': format(now, 'MMM d'),
    'date:ddd': format(now, 'EEE'),
    'date:dddd': format(now, 'EEEE'),
    
    // Time variables
    'time:HH:mm': format(now, 'HH:mm'),
    'time:HH:mm:ss': format(now, 'HH:mm:ss'),
    'time:hh:mm A': format(now, 'hh:mm a'),
    
    // Week variables
    weekNumber: getWeek(now),
    
    // Custom variables
    ...customVars,
  };
}

/**
 * Substitute variables in template content
 */
export function substituteVariables(
  content: string,
  customVars: TemplateVariables = {}
): string {
  const variables = getBuiltInVariables(customVars);
  
  let result = content;
  
  // Replace all variables in format {{variableName}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  });
  
  return result;
}

/**
 * Extract variables from template content
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set<string>();
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
}

/**
 * Get required user input variables from template
 * (excludes built-in date/time variables)
 */
export function getRequiredInputVariables(content: string): string[] {
  const allVariables = extractVariables(content);
  const builtInKeys = Object.keys(getBuiltInVariables());
  
  return allVariables.filter(
    (variable) => !builtInKeys.includes(variable) && !variable.startsWith('date:') && !variable.startsWith('time:')
  );
}

/**
 * Validate template content
 */
export function validateTemplate(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for unmatched braces
  const openBraces = (content.match(/\{\{/g) || []).length;
  const closeBraces = (content.match(/\}\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push('Unmatched braces in template');
  }
  
  // Check for empty variables
  if (content.match(/\{\{\s*\}\}/)) {
    errors.push('Empty variable found in template');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format date for daily note title
 */
export function formatDailyNoteTitle(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: Date): string {
  return format(date, 'EEEE, MMMM d, yyyy');
}

/**
 * Parse daily note title to date
 */
export function parseDailyNoteDate(title: string): Date | null {
  // Match YYYY-MM-DD format
  const match = title.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Default template content generator
 */
export const defaultTemplates = {
  daily: (date: Date) => `# ${formatDailyNoteTitle(date)}

## 📅 ${formatDateDisplay(date)}

### 🎯 Goals for Today
- 

### 📝 Notes


### ✅ Completed


### 💭 Reflections


---
Created: ${format(date, 'HH:mm')}`,

  weekly: (date: Date) => `# Week of ${formatDailyNoteTitle(date)}

## 🗓️ Week ${getWeek(date)}

### 🎯 Goals for This Week
- 

### 📊 Progress


### 🏆 Wins


### 📚 Learnings


### ➡️ Next Week


---
Created: ${format(date, 'yyyy-MM-dd HH:mm')}`,

  meeting: (title: string, date: Date) => `# Meeting: ${title}

**Date:** ${format(date, 'yyyy-MM-dd')}
**Time:** ${format(date, 'HH:mm')}
**Attendees:** 

## 📋 Agenda


## 📝 Notes


## ✅ Action Items
- [ ] 

## 🔗 Related
- 

---
Next meeting: `,
};

