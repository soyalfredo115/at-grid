import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Mueve el elemento host a `document.body` al crearse, y lo quita al destruirse.
 *
 * Equivalente a `createPortal(children, document.body)` de React: se usa para
 * los popovers de AtGrid (menú de columna, filtro set, panel de columnas,
 * export) para que no queden recortados por el `overflow-x: auto` de la
 * tabla ni por el scroll de la página.
 *
 * Angular no depende de la posición real en el DOM para gestionar el ciclo de
 * vida de la vista (usa el anchor/comment de la ubicación lógica), así que
 * mover el nodo es seguro: `ngOnDestroy` se sigue disparando cuando el `@if`
 * que lo envuelve se cierra.
 */
@Directive({
  selector: '[atGridPortal]',
  standalone: true,
})
export class AtGridPortalDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    document.body.appendChild(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.remove();
  }
}
