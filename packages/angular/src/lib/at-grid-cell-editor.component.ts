import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import type { AtGridColumn } from './at-grid.types';

export type CellEditorMove = { dr: number; dc: number } | null;
export interface CellEditorCommit {
  raw: string;
  move: CellEditorMove;
}

type CustomEditorContext<T> = {
  $implicit: unknown;
  row: T;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

/**
 * Editor de celda: input/select por defecto, o la plantilla de `atGridCellEditor`
 * si la columna trae una. Puerto del `CellEditor` de React. Enter/Tab confirman y
 * mueven el foco (según lo resuelva el padre), Escape cancela.
 */
@Component({
  selector: 'at-grid-cell-editor',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (customTpl(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl; context: customContext()"></ng-container>
    } @else if (isSelect()) {
      <select
        #ctrl
        class="ag-edit-input"
        [value]="value()"
        (change)="value.set($any($event.target).value)"
        (blur)="commitOnce(null)"
        (keydown)="onKeyDown($event)"
      >
        @for (o of options(); track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </select>
    } @else {
      <input
        #ctrl
        class="ag-edit-input"
        [type]="inputType()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        (blur)="commitOnce(null)"
        (keydown)="onKeyDown($event)"
      />
    }
  `,
  styles: [
    `
      .ag-edit-input {
        width: 100%;
        min-width: 0;
        padding: 5px 6px;
        font-size: 13px;
        background: var(--surface, #fffefb);
        color: var(--text, #1a1714);
        border: 1px solid var(--primary, #b8553a);
        border-radius: 3px;
      }
      .ag-edit-input:focus {
        outline: none;
      }
    `,
  ],
})
export class AtGridCellEditorComponent<T> implements OnInit, AfterViewInit {
  col = input.required<AtGridColumn<T>>();
  row = input.required<T>();
  initial = input.required<string>();
  customTpl = input<TemplateRef<CustomEditorContext<T>> | null>(null);

  commit = output<CellEditorCommit>();
  cancel = output<void>();

  value = signal('');
  private done = false;

  @ViewChild('ctrl') private ctrlRef?: ElementRef<HTMLInputElement | HTMLSelectElement>;

  editorType = computed(() => this.col().editorType ?? (this.col().numeric ? 'number' : 'text'));
  isSelect = computed(() => this.editorType() === 'select');
  inputType = computed(() => {
    const t = this.editorType();
    return t === 'number' ? 'number' : t === 'date' ? 'date' : 'text';
  });
  options = computed(() =>
    (this.col().editorOptions ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  );
  customContext = computed<CustomEditorContext<T>>(() => {
    const col = this.col();
    const initial = this.initial();
    return {
      $implicit: col.valueParser ? col.valueParser(initial, this.row()) : initial,
      row: this.row(),
      onCommit: (v: unknown) => this.commitOnce({ dr: 1, dc: 0 }, String(v)),
      onCancel: () => this.cancelOnce(),
    };
  });

  ngOnInit(): void {
    this.value.set(this.initial());
  }

  ngAfterViewInit(): void {
    const el = this.ctrlRef?.nativeElement;
    el?.focus();
    if (el instanceof HTMLInputElement) el.select();
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancelOnce();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.commitOnce({ dr: 1, dc: 0 });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.commitOnce({ dr: 0, dc: e.shiftKey ? -1 : 1 });
    } else {
      e.stopPropagation();
    }
  }

  /** Idempotente: desmontar el control enfocado puede disparar un blur de todas formas. */
  commitOnce(move: CellEditorMove, rawOverride?: string): void {
    if (this.done) return;
    this.done = true;
    this.commit.emit({ raw: rawOverride ?? this.value(), move });
  }

  cancelOnce(): void {
    if (this.done) return;
    this.done = true;
    this.cancel.emit();
  }
}
