import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  input,
  output,
} from '@angular/core';
import { AtGridPortalDirective } from './at-grid-portal.directive';

/**
 * Popover flotante anclado con posición fija, portado a `document.body`
 * (sobrevive al `overflow-x: auto` de la tabla). Puerto del `Popover` de
 * SA Finance (React, con `createPortal`).
 */
@Component({
  selector: 'at-grid-popover',
  standalone: true,
  imports: [AtGridPortalDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #box atGridPortal class="ag-popover" [style.top.px]="top" [style.left.px]="left" [style.width.px]="width()">
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        --bg: var(--bg, #f6f4ef);
        --bg-2: var(--bg-2, #efebe2);
        --surface: var(--surface, #fffefb);
        --border: var(--border, #e0dace);
        --border-2: var(--border-2, #cec6b6);
        --text: var(--text, #1a1714);
        --text-2: var(--text-2, #6b645c);
        --text-3: var(--text-3, #a39b90);
        --primary: var(--primary, #b8553a);
        --primary-dark: var(--primary-dark, #93422c);
        --primary-darker: var(--primary-darker, #7a3624);
        --primary-light: var(--primary-light, #f3e6df);
        --primary-tint: var(--primary-tint, #f3e6df);
        --success: var(--success, #2f6b4f);
        --radius: var(--radius, 4px);
        --radius-sm: var(--radius-sm, 3px);
        --radius-xs: var(--radius-xs, 2px);
        --shadow-md: var(--shadow-md, 0 8px 24px -12px rgba(40, 30, 20, 0.4));
        --ring-primary: var(--ring-primary, rgba(184, 85, 58, 0.25));
      }

      .ag-popover {
        position: fixed;
        z-index: 60;
        max-height: 70vh;
        overflow-y: auto;
        background: var(--surface);
        border: 1px solid var(--border-2);
        border-radius: var(--radius-sm);
        padding: 4px 0;
        box-shadow: var(--shadow-md);
      }
    `,
  ],
})
export class AtGridPopoverComponent implements OnInit, OnDestroy {
  anchor = input.required<HTMLElement>();
  width = input<number>(224);
  closed = output<void>();

  @ViewChild('box', { static: true }) boxRef!: ElementRef<HTMLElement>;

  top = 0;
  left = 0;

  private readonly onDown = (e: MouseEvent): void => {
    const t = e.target as Node;
    if (this.boxRef.nativeElement.contains(t) || this.anchor().contains(t)) return;
    this.closed.emit();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.closed.emit();
  };

  private readonly onScroll = (e: Event): void => {
    if (this.boxRef.nativeElement.contains(e.target as Node)) return;
    this.closed.emit();
  };

  private readonly onResize = (): void => this.closed.emit();

  ngOnInit(): void {
    const r = this.anchor().getBoundingClientRect();
    const w = this.width();
    this.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    this.top = Math.min(r.bottom + 4, window.innerHeight - 16);
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onResize);
  }
}
