import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * AtGridPaginationComponent — barra de paginación de AtGrid.
 * Puerto de SA Finance (Pagination.tsx). No se renderiza si pageCount <= 1
 * y no hay selector de tamaño de página.
 */
@Component({
  selector: 'at-grid-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pageCount() > 1 || pageSizeOptions().length) {
      <div class="ag-pagination">
        <span class="ag-pagination-info">
          <span class="ag-pagination-text">Mostrando {{ from() }}–{{ to() }} de {{ total() }}</span>
          @if (pageSizeOptions().length) {
            <label class="ag-pagination-size">
              <select [value]="pageSize()" (change)="onSizeChange($event)">
                @for (o of pageSizeOptions(); track o) {
                  <option [value]="o">{{ o }}</option>
                }
              </select>
              por página
            </label>
          }
        </span>

        <div class="ag-pagination-nav">
          <button
            class="ag-pg-btn"
            (click)="pageChange.emit(page() - 1)"
            [disabled]="page() === 1"
            aria-label="Página anterior"
          >
            &lt;
          </button>

          @for (item of pageItems(); track $index) {
            @if (item === '...') {
              <span class="ag-pg-ellipsis">…</span>
            } @else {
              <button
                class="ag-pg-btn"
                [class.ag-pg-btn-active]="item === page()"
                (click)="pageChange.emit(item)"
                [attr.aria-current]="item === page() ? 'page' : null"
              >
                {{ item }}
              </button>
            }
          }

          <button
            class="ag-pg-btn"
            (click)="pageChange.emit(page() + 1)"
            [disabled]="page() === pageCount()"
            aria-label="Página siguiente"
          >
            &gt;
          </button>
        </div>
      </div>
    }
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

      .ag-pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1.25rem;
        border-top: 1px solid var(--border);
        background: var(--bg);
        font-size: 13px;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .ag-pagination-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .ag-pagination-text {
        color: var(--text-2);
        font-size: 12px;
      }
      .ag-pagination-size {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 12px;
        color: var(--text-3);
      }
      .ag-pagination-size select {
        padding: 0.15rem 0.4rem;
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-xs);
        background: var(--surface);
        color: var(--text);
        cursor: pointer;
      }
      .ag-pagination-size select:focus-visible {
        outline: none;
        box-shadow: var(--ring-primary);
      }
      .ag-pagination-nav {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .ag-pg-btn {
        padding: 0.3rem 0.6rem;
        font-size: 12px;
        border-radius: var(--radius-xs);
        border: none;
        background: transparent;
        color: var(--text-2);
        cursor: pointer;
        transition: background 0.12s;
        font-variant-numeric: tabular-nums;
      }
      .ag-pg-btn:hover:not(:disabled) {
        background: var(--bg-2);
      }
      .ag-pg-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .ag-pg-btn-active {
        background: var(--primary);
        color: #fff;
      }
      .ag-pg-btn-active:hover {
        background: var(--primary);
      }
      .ag-pg-ellipsis {
        padding: 0.3rem 0.3rem;
        font-size: 12px;
        color: var(--text-3);
        user-select: none;
      }
    `,
  ],
})
export class AtGridPaginationComponent {
  page = input.required<number>();
  pageCount = input.required<number>();
  from = input.required<number>();
  to = input.required<number>();
  total = input.required<number>();
  pageSize = input<number>(0);
  pageSizeOptions = input<number[]>([]);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  readonly pageItems = computed<Array<number | '...'>>(() => buildPageItems(this.page(), this.pageCount()));

  onSizeChange(e: Event): void {
    const n = Number((e.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(n);
  }
}

/** Genera la lista de ítems de página a mostrar (números y '...'). */
function buildPageItems(page: number, pageCount: number): Array<number | '...'> {
  if (pageCount <= 7) {
    return Array.from({ length: Math.max(1, pageCount) }, (_, i) => i + 1);
  }

  const items: Array<number | '...'> = [];
  items.push(1);

  const rangeStart = Math.max(2, page - 2);
  const rangeEnd = Math.min(pageCount - 1, page + 2);

  if (rangeStart > 2) items.push('...');
  for (let i = rangeStart; i <= rangeEnd; i++) items.push(i);
  if (rangeEnd < pageCount - 1) items.push('...');

  items.push(pageCount);
  return items;
}
