/**
 * Utility functions for canvas operations
 */
import { fabric } from 'fabric';
import type { NoteCardData, ConnectionData, Point } from './types';

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a note card on the canvas
 */
export function createNoteCard(data: NoteCardData): fabric.Group {
  const { id, title, content, x, y, width, height, backgroundColor } = data;

  // Background rectangle
  const background = new fabric.Rect({
    width,
    height,
    fill: backgroundColor,
    stroke: '#3b82f6',
    strokeWidth: 2,
    rx: 8,
    ry: 8,
    shadow: new fabric.Shadow({
      color: 'rgba(0, 0, 0, 0.2)',
      blur: 10,
      offsetX: 0,
      offsetY: 4,
    }),
  });

  // Title text
  const titleText = new fabric.Textbox(title, {
    width: width - 20,
    fontSize: 16,
    fontWeight: 'bold',
    fill: '#1f2937',
    textAlign: 'left',
    top: 10,
    left: 10,
    editable: false,
  });

  // Content text (truncated)
  const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;
  const contentText = new fabric.Textbox(contentPreview, {
    width: width - 20,
    fontSize: 12,
    fill: '#6b7280',
    textAlign: 'left',
    top: 40,
    left: 10,
    editable: false,
  });

  // Create group
  const group = new fabric.Group([background, titleText, contentText], {
    left: x,
    top: y,
    selectable: true,
    hasControls: true,
    hasBorders: true,
  });

  // Store custom data
  (group as any).customData = { ...data, type: 'note-card' };
  (group as any).id = id;

  return group;
}

/**
 * Create a text block on the canvas
 */
export function createTextBlock(
  text: string,
  x: number,
  y: number,
  fontSize: number = 14
): fabric.Textbox {
  const textbox = new fabric.Textbox(text, {
    left: x,
    top: y,
    width: 200,
    fontSize,
    fill: '#1f2937',
    fontFamily: 'Arial',
    editable: true,
    selectable: true,
  });

  const id = generateId();
  (textbox as any).id = id;
  (textbox as any).customData = { type: 'text-block', id };

  return textbox;
}

/**
 * Create an arrow/connection between two objects
 */
export function createConnection(
  from: fabric.Object,
  to: fabric.Object,
  color: string = '#3b82f6'
): fabric.Group {
  const fromPoint = from.getCenterPoint();
  const toPoint = to.getCenterPoint();

  // Calculate arrow angle
  const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
  const arrowLength = 15;
  const arrowAngle = Math.PI / 6;

  // Line
  const line = new fabric.Line([fromPoint.x, fromPoint.y, toPoint.x, toPoint.y], {
    stroke: color,
    strokeWidth: 2,
    selectable: false,
  });

  // Arrow head
  const arrowHead1 = new fabric.Line(
    [
      toPoint.x,
      toPoint.y,
      toPoint.x - arrowLength * Math.cos(angle - arrowAngle),
      toPoint.y - arrowLength * Math.sin(angle - arrowAngle),
    ],
    {
      stroke: color,
      strokeWidth: 2,
      selectable: false,
    }
  );

  const arrowHead2 = new fabric.Line(
    [
      toPoint.x,
      toPoint.y,
      toPoint.x - arrowLength * Math.cos(angle + arrowAngle),
      toPoint.y - arrowLength * Math.sin(angle + arrowAngle),
    ],
    {
      stroke: color,
      strokeWidth: 2,
      selectable: false,
    }
  );

  const group = new fabric.Group([line, arrowHead1, arrowHead2], {
    selectable: true,
    hasControls: false,
  });

  const id = generateId();
  (group as any).id = id;
  (group as any).customData = {
    type: 'connection',
    id,
    from: (from as any).id,
    to: (to as any).id,
  };

  return group;
}

/**
 * Update connection when objects move
 */
export function updateConnection(
  connection: fabric.Group,
  from: fabric.Object,
  to: fabric.Object
): void {
  const fromPoint = from.getCenterPoint();
  const toPoint = to.getCenterPoint();
  const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
  const arrowLength = 15;
  const arrowAngle = Math.PI / 6;

  const objects = connection.getObjects();
  const line = objects[0] as fabric.Line;
  const arrowHead1 = objects[1] as fabric.Line;
  const arrowHead2 = objects[2] as fabric.Line;

  // Update line
  line.set({
    x1: fromPoint.x - connection.left!,
    y1: fromPoint.y - connection.top!,
    x2: toPoint.x - connection.left!,
    y2: toPoint.y - connection.top!,
  });

  // Update arrow heads
  arrowHead1.set({
    x1: toPoint.x - connection.left!,
    y1: toPoint.y - connection.top!,
    x2: toPoint.x - connection.left! - arrowLength * Math.cos(angle - arrowAngle),
    y2: toPoint.y - connection.top! - arrowLength * Math.sin(angle - arrowAngle),
  });

  arrowHead2.set({
    x1: toPoint.x - connection.left!,
    y1: toPoint.y - connection.top!,
    x2: toPoint.x - connection.left! - arrowLength * Math.cos(angle + arrowAngle),
    y2: toPoint.y - connection.top! - arrowLength * Math.sin(angle + arrowAngle),
  });
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Check if point is inside rectangle
 */
export function pointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Get color palette for cards
 */
export const CARD_COLORS = [
  '#fef3c7', // yellow
  '#dbeafe', // blue
  '#d1fae5', // green
  '#fce7f3', // pink
  '#e0e7ff', // indigo
  '#fed7aa', // orange
  '#e9d5ff', // purple
  '#f3f4f6', // gray
];

/**
 * Get random color from palette
 */
export function getRandomColor(): string {
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
}

