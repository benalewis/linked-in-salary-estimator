import { describe, expect, it } from 'vitest';
import { mouseEventTargetElement } from '@/lib/event-target';

describe('mouseEventTargetElement', () => {
  it('returns the element when target is an element', () => {
    const btn = document.createElement('button');
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: btn, enumerable: true });
    expect(mouseEventTargetElement(ev)).toBe(btn);
  });

  it('returns parent element when target is a Text node (button label click)', () => {
    const btn = document.createElement('button');
    btn.appendChild(document.createTextNode('Run'));
    const text = btn.firstChild as Text;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: text, enumerable: true });
    expect(mouseEventTargetElement(ev)).toBe(btn);
  });
});
