import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ZoomService {
  private zoomContainerEl!: HTMLElement;
  private zoomContentEl!: HTMLElement;

  private initialDistance!: number;
  private zoomScale = 1;

  private isDragging = false;
  private lastPosition = { x: 0, y: 0 };
  private scrollPosition = { x: 0, y: 0 };

  init(zoomContainer: HTMLElement, zoomContent: HTMLElement) {
    this.zoomContainerEl = zoomContainer;
    this.zoomContentEl = zoomContent;

    this.addTouchListeners();
    this.addMouseListeners();

    this.zoomContainerEl.addEventListener('touchstart', (e: TouchEvent) => {
      this.handleTouchStart(e);
      this.handleDragStart(e);
    });
    this.zoomContainerEl.addEventListener('touchmove', (e: TouchEvent) => {
      this.handleTouchMove(e);
      this.handleDragMove(e);
    });
    this.zoomContainerEl.addEventListener('touchend', (e: TouchEvent) => {
      this.handleTouchEnd(e);
      this.handleDragEnd(e);
    });

    this.zoomContainerEl.addEventListener('touchmove', this.handleDragMove);
    this.zoomContainerEl.addEventListener('touchend', this.handleDragEnd);
  }

  private addTouchListeners() {
    this.zoomContainerEl.addEventListener('touchstart', (e: TouchEvent) => {
      this.handleTouchStart(e);
      this.handleDragStart(e);
    });
    this.zoomContainerEl.addEventListener('touchmove', (e: TouchEvent) => {
      this.handleTouchMove(e);
      this.handleDragMove(e);
    });
    this.zoomContainerEl.addEventListener('touchend', (e: TouchEvent) => {
      this.handleTouchEnd(e);
      this.handleDragEnd(e);
    });
  }

  private addMouseListeners() {
    this.zoomContainerEl.addEventListener('mousedown', (e: MouseEvent) => {
      this.handleDragStart(e);
    });
    this.zoomContainerEl.addEventListener('mousemove', (e: MouseEvent) => {
      this.handleDragMove(e);
    });
    this.zoomContainerEl.addEventListener('mouseup', (e: MouseEvent) => {
      this.handleDragEnd(e);
    });
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.initialDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
    }
  }

  private handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();

      const newDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );

      const scaleValue = (newDistance / this.initialDistance) * this.zoomScale;

      if (newDistance !== this.initialDistance) {
        // prevent desktop animation on mobile
        this.zoomContentEl.style.transition = 'none';
        // prevent negative zoom out
        if (scaleValue >= 1) {
          const transform = `scale(${scaleValue})`;
          this.zoomContentEl.style.transform = transform;
          this.zoomContentEl.style.webkitTransform = transform;
          this.zoomContentEl.style.transformOrigin = 'top';
        }
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    this.initialDistance = 0;
    // preserve current scale
    this.zoomScale = parseFloat(this.zoomContentEl.style.transform.slice(6));
  }

  private handleDragStart(e: MouseEvent | TouchEvent) {
    this.isDragging = true;
    this.lastPosition = this.getPosition(e);
    this.zoomContentEl.style.cursor = 'grabbing';
  }

  private handleDragMove(e: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;

    e.preventDefault();

    const currentPosition = this.getPosition(e);
    const delta = {
      x: currentPosition.x - this.lastPosition.x,
      y: currentPosition.y - this.lastPosition.y,
    };
    this.lastPosition = currentPosition;

    this.scrollPosition.x -= delta.x;
    this.scrollPosition.y -= delta.y;

    if ('touches' in e) {
      this.zoomContainerEl.scrollLeft = this.scrollPosition.x;
      this.zoomContainerEl.scrollTop = this.scrollPosition.y;
    } else {
      const container = this.zoomContainerEl;
      container.scrollLeft -= delta.x;
      container.scrollTop -= delta.y;
    }
  }

  private handleDragEnd(e: MouseEvent | TouchEvent) {
    this.isDragging = false;
    this.zoomContentEl.style.cursor = 'grab';

    if ('touches' in e) {
      this.zoomContainerEl.removeEventListener(
        'touchmove',
        this.handleDragMove
      );
      this.zoomContainerEl.removeEventListener('touchend', this.handleDragEnd);
    } else {
      document.removeEventListener('mousemove', this.handleDragMove);
      document.removeEventListener('mouseup', this.handleDragEnd);
    }
  }

  private getPosition(e: MouseEvent | TouchEvent) {
    return {
      x: 'touches' in e ? e.touches[0].clientX : e.clientX,
      y: 'touches' in e ? e.touches[0].clientY : e.clientY,
    };
  }
}
