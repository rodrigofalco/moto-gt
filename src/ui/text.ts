import type Phaser from 'phaser';

// Character-count truncation with an ellipsis — for monospace blocks where the
// column width is a fixed character budget.
export function ellipsize(s: string, maxChars: number): string {
  return s.length <= maxChars ? s : s.slice(0, Math.max(1, maxChars - 1)) + '…';
}

// Pixel-measured truncation for proportional fonts: shrinks the text object's
// string until it fits maxWidth, appending an ellipsis.
export function fitText(t: Phaser.GameObjects.Text, maxWidth: number): void {
  if (t.width <= maxWidth) return;
  let s = t.text;
  while (s.length > 1 && t.width > maxWidth) {
    s = s.slice(0, -1);
    t.setText(s + '…');
  }
}
