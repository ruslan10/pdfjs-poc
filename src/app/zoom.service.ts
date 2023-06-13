import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ZoomService {
  zoomContainerEl: any;
  zoomContentEl: any;

  initialDistance!: number;
  zoomScale = 1;

  isDragging = false;
  lastPosition = { x: 0, y: 0 };
  scrollPosition = { x: 0, y: 0 };

  init(zoomContainer: any, zoomContent: any) {
    this.zoomContainerEl = zoomContainer;
    this.zoomContentEl = zoomContent;

    this.zoomContainerEl.addEventListener('touchstart', (e: any) => {
      this.handleTouchStart(e);
      this.handleDragStart(e);
    });
    this.zoomContainerEl.addEventListener('touchmove', (e: any) => {
      this.handletouchMove(e);
      this.handleDragMove(e);
    });
    this.zoomContainerEl.addEventListener('touchend', (e: any) => {
      this.handleTouchEnd(e);
      this.handleDragEnd(e);
    });

    this.zoomContainerEl.addEventListener('mousedown', (e: any) => {
      this.handleDragStart(e);
    });
    this.zoomContainerEl.addEventListener('mousemove', (e: any) => {
      this.handleDragMove(e);
    });
    this.zoomContainerEl.addEventListener('mouseup', (e: any) => {
      this.handleDragEnd(e);
    });
  }
  handleTouchStart(e: any) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.initialDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    }
  }
  handletouchMove(e: any) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);

      const scaleValue = (distance / this.initialDistance) * this.zoomScale;

      // prevent desktop animation on mobile
      this.zoomContentEl.style.transition = 'none';
      // prevent negative zoom out
      if (scaleValue >= 1) {
        const transform = `scale(${scaleValue})`;
        this.zoomContentEl.style.transform = transform;
        this.zoomContentEl.style.WebkitTransform = transform;
        this.zoomContentEl.style.transformOrigin = 'top';
      }
    }
  }
  handleTouchEnd(e: any) {
    this.initialDistance = 0;
    // preserve current scale
    this.zoomScale = parseFloat(this.zoomContentEl.style.transform.slice(6));
  }
  handleDragStart(e: any) {
    this.isDragging = true;
    this.lastPosition = this.getPosition(e);
    this.zoomContentEl.style.cursor = 'grabbing';
  }
  handleDragMove(e: any) {
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
    const container = this.zoomContainerEl;

    container.scrollLeft = this.scrollPosition.x;
    container.scrollTop = this.scrollPosition.y;
  }
  handleDragEnd(e: any) {
    this.isDragging = false;
    this.zoomContentEl.style.cursor = 'grab';
  }

  private getPosition(e: any) {
    return {
      x: e.clientX || e.touches[0].clientX,
      y: e.clientY || e.touches[0].clientY,
    };
  }
}


