import { Injectable } from '@angular/core';
import { shadow } from 'pdfjs-dist';
import { DEFAULT_SCALE, DEFAULT_SCALE_DELTA, MAX_SCALE, MIN_SCALE, PresentationModeState, UNKNOWN_SCALE } from 'pdfjs-dist/types/web/ui_utils';


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

  _touchInfo: any = null;
  _currentScale = UNKNOWN_SCALE;

  presentationModeState = PresentationModeState.UNKNOWN;

  get currentScale() {
    return this._currentScale !== UNKNOWN_SCALE
      ? this._currentScale
      : DEFAULT_SCALE;
  }

  setScaleUpdatePages( newScale: any, newValue: any, { noScroll = false, preset = false, drawingDelay = -1 } ) {
    this._currentScaleValue = newValue.toString();

    if (this.#isSameScale(newScale)) {
      if (preset) {
        this.eventBus.dispatch("scalechanging", {
          source: this,
          scale: newScale,
          presetValue: newValue,
        });
      }
      return;
    }

    this.viewer.style.setProperty(
      "--scale-factor",
      newScale * PixelsPerInch.PDF_TO_CSS_UNITS
    );

    const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000;
    this.refresh(true, {
      scale: newScale,
      drawingDelay: postponeDrawing ? drawingDelay : -1,
    });

    if (postponeDrawing) {
      this.#scaleTimeoutId = setTimeout(() => {
        this.#scaleTimeoutId = null;
        this.refresh();
      }, drawingDelay);
    }

    this._currentScale = newScale;

    if (!noScroll) {
      let page = this._currentPageNumber,
        dest;
      if (
        this._location &&
        !(this.isInPresentationMode || this.isChangingPresentationMode)
      ) {
        page = this._location.pageNumber;
        dest = [
          null,
          { name: "XYZ" },
          this._location.left,
          this._location.top,
          null,
        ];
      }
      this.scrollPageIntoView({
        pageNumber: page,
        destArray: dest,
        allowNegativeOffset: true,
      });
    }

    this.eventBus.dispatch("scalechanging", {
      source: this,
      scale: newScale,
      presetValue: preset ? newValue : undefined,
    });

    if (this.defaultRenderingQueue) {
      this.update();
    }
  }

  setScale(value: any, options: any) {
    let scale = parseFloat(value);

    if (scale > 0) {
      options.preset = false;
      this.#setScaleUpdatePages(scale, value, options);
    } else {
      const currentPage = this._pages[this._currentPageNumber - 1];
      if (!currentPage) {
        return;
      }
      let hPadding = SCROLLBAR_PADDING,
        vPadding = VERTICAL_PADDING;

      if (this.isInPresentationMode) {
        // Pages have a 2px (transparent) border in PresentationMode, see
        // the `web/pdf_viewer.css` file.
        hPadding = vPadding = 4; // 2 * 2px
        if (this._spreadMode !== SpreadMode.NONE) {
          // Account for two pages being visible in PresentationMode, thus
          // "doubling" the total border width.
          hPadding *= 2;
        }
      } else if (
        (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) &&
        this.removePageBorders
      ) {
        hPadding = vPadding = 0;
      } else if (this._scrollMode === ScrollMode.HORIZONTAL) {
        [hPadding, vPadding] = [vPadding, hPadding]; // Swap the padding values.
      }
      const pageWidthScale =
        (((this.container.clientWidth - hPadding) / currentPage.width) *
          currentPage.scale) /
        this.#pageWidthScaleFactor;
      const pageHeightScale =
        ((this.container.clientHeight - vPadding) / currentPage.height) *
        currentPage.scale;
      switch (value) {
        case "page-actual":
          scale = 1;
          break;
        case "page-width":
          scale = pageWidthScale;
          break;
        case "page-height":
          scale = pageHeightScale;
          break;
        case "page-fit":
          scale = Math.min(pageWidthScale, pageHeightScale);
          break;
        case "auto":
          // For pages in landscape mode, fit the page height to the viewer
          // *unless* the page would thus become too wide to fit horizontally.
          const horizontalScale = isPortraitOrientation(currentPage)
            ? pageWidthScale
            : Math.min(pageHeightScale, pageWidthScale);
          scale = Math.min(MAX_AUTO_SCALE, horizontalScale);
          break;
        default:
          console.error(`#setScale: "${value}" is an unknown zoom value.`);
          return;
      }
      options.preset = true;
      this.#setScaleUpdatePages(scale, value, options);
    }
  }

  /**
   * Increase the current zoom level one, or more, times.
   * @param {ChangeScaleOptions} [options]
   */
   increaseScale({ drawingDelay, scaleFactor, steps }: any = {}) {
    // if (!this.pdfDocument) {
    //   return;
    // }
    let newScale: any = this._currentScale;
    if (scaleFactor > 1) {
      newScale = Math.round(newScale * scaleFactor * 100) / 100;
    } else {
      steps ??= 1;
      do {
        newScale =
          Math.ceil(<any>(newScale * DEFAULT_SCALE_DELTA).toFixed(2) * 10) / 10;
      } while (--steps > 0 && newScale < MAX_SCALE);
    }
    this.setScale(Math.min(MAX_SCALE, newScale), {
      noScroll: false,
      drawingDelay,
    });
  }

  decreaseScale({ drawingDelay, scaleFactor, steps }: any = {}) {
    // if (!this.pdfDocument) {
    //   return;
    // }
    let newScale: any = this._currentScale;
    if (scaleFactor > 0 && scaleFactor < 1) {
      newScale = Math.round(newScale * scaleFactor * 100) / 100;
    } else {
      steps ??= 1;
      do {
        newScale =
          Math.floor(<any>(newScale / DEFAULT_SCALE_DELTA).toFixed(2) * 10) / 10;
      } while (--steps > 0 && newScale > MIN_SCALE);
    }
    this.setScale(Math.max(MIN_SCALE, newScale), {
      noScroll: false,
      drawingDelay,
    });
  }

  _accumulateFactor(previousScale: any, factor: any, prop: any) {
    if (factor === 1) {
      return 1;
    }
    // If the direction changed, reset the accumulated factor.
    if ((this[prop] > 1 && factor < 1) || (this[prop] < 1 && factor > 1)) {
      this[prop] = 1;
    }

    const newFactor =
      Math.floor(previousScale * factor * this[prop] * 100) /
      (100 * previousScale);
    this[prop] = factor / newFactor;

    return newFactor;
  }

  _accumulateTicks(ticks: any, prop: any) {
    // If the direction changed, reset the accumulated ticks.
    if ((this[prop] > 0 && ticks < 0) || (this[prop] < 0 && ticks > 0)) {
      this[prop] = 0;
    }
    this[prop] += ticks;
    const wholeTicks = Math.trunc(this[prop]);
    this[prop] -= wholeTicks;
    return wholeTicks;
  }

  get isInPresentationMode() {
    return this.presentationModeState === PresentationModeState.FULLSCREEN;
  }

  get isChangingPresentationMode() {
    return this.presentationModeState === PresentationModeState.CHANGING;
  }

  zoomIn(steps: any, scaleFactor?: any) {
    if (this.isInPresentationMode) {
      return;
    }
    this.increaseScale({
      drawingDelay: 1, // AppOptions.get("defaultZoomDelay"),
      steps,
      scaleFactor,
    });
  }

  zoomOut(steps: any, scaleFactor?: any) {
    if (this.isInPresentationMode) {
      return;
    }
    this.decreaseScale({
      drawingDelay: 1, // AppOptions.get("defaultZoomDelay"),
      steps,
      scaleFactor,
    });
  }

  get supportsPinchToZoom() {
    return shadow(this, "supportsPinchToZoom", true);
  }

  webViewerTouchStart(evt: any) {
    if (evt.touches.length < 2 ) {
      return;
    }
    evt.preventDefault();
  
    if (evt.touches.length !== 2) {
      this._touchInfo = null;
      return;
    }
  
    let [touch0, touch1] = evt.touches;
    if (touch0.identifier > touch1.identifier) {
      [touch0, touch1] = [touch1, touch0];
    }
    this._touchInfo = {
      touch0X: touch0.pageX,
      touch0Y: touch0.pageY,
      touch1X: touch1.pageX,
      touch1Y: touch1.pageY,
    };
  }

  webViewerTouchMove(evt: any) {
    if (!this._touchInfo || evt.touches.length !== 2) {
      return;
    }
  
    // const { pdfViewer, _touchInfo, supportsPinchToZoom } = PDFViewerApplication;
    let [touch0, touch1] = evt.touches;
    if (touch0.identifier > touch1.identifier) {
      [touch0, touch1] = [touch1, touch0];
    }
    const { pageX: page0X, pageY: page0Y } = touch0;
    const { pageX: page1X, pageY: page1Y } = touch1;
    const {
      touch0X: pTouch0X,
      touch0Y: pTouch0Y,
      touch1X: pTouch1X,
      touch1Y: pTouch1Y,
    } = this._touchInfo;
  
    if (
      Math.abs(pTouch0X - page0X) <= 1 &&
      Math.abs(pTouch0Y - page0Y) <= 1 &&
      Math.abs(pTouch1X - page1X) <= 1 &&
      Math.abs(pTouch1Y - page1Y) <= 1
    ) {
      // Touches are really too close and it's hard do some basic
      // geometry in order to guess something.
      return;
    }
  
    this._touchInfo.touch0X = page0X;
    this._touchInfo.touch0Y = page0Y;
    this._touchInfo.touch1X = page1X;
    this._touchInfo.touch1Y = page1Y;
  
    if (pTouch0X === page0X && pTouch0Y === page0Y) {
      // First touch is fixed, if the vectors are collinear then we've a pinch.
      const v1X = pTouch1X - page0X;
      const v1Y = pTouch1Y - page0Y;
      const v2X = page1X - page0X;
      const v2Y = page1Y - page0Y;
      const det = v1X * v2Y - v1Y * v2X;
      // 0.02 is approximatively sin(0.15deg).
      if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
        return;
      }
    } else if (pTouch1X === page1X && pTouch1Y === page1Y) {
      // Second touch is fixed, if the vectors are collinear then we've a pinch.
      const v1X = pTouch0X - page1X;
      const v1Y = pTouch0Y - page1Y;
      const v2X = page0X - page1X;
      const v2Y = page0Y - page1Y;
      const det = v1X * v2Y - v1Y * v2X;
      if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
        return;
      }
    } else {
      const diff0X = page0X - pTouch0X;
      const diff1X = page1X - pTouch1X;
      const diff0Y = page0Y - pTouch0Y;
      const diff1Y = page1Y - pTouch1Y;
      const dotProduct = diff0X * diff1X + diff0Y * diff1Y;
      if (dotProduct >= 0) {
        // The two touches go in almost the same direction.
        return;
      }
    }
  
    evt.preventDefault();
  
    const distance = Math.hypot(page0X - page1X, page0Y - page1Y) || 1;
    const pDistance = Math.hypot(pTouch0X - pTouch1X, pTouch0Y - pTouch1Y) || 1;
    const previousScale = this.currentScale;
    if (this.supportsPinchToZoom) {
      const newScaleFactor = this._accumulateFactor(
        previousScale,
        distance / pDistance,
        "_touchUnusedFactor"
      );
      if (newScaleFactor < 1) {
        this.zoomOut(null, newScaleFactor);
      } else if (newScaleFactor > 1) {
        this.zoomIn(null, newScaleFactor);
      } else {
        return;
      }
    } else {
      const PIXELS_PER_LINE_SCALE = 30;
      const ticks = this._accumulateTicks(
        (distance - pDistance) / PIXELS_PER_LINE_SCALE,
        "_touchUnusedTicks"
      );
      if (ticks < 0) {
        this.zoomOut(-ticks);
      } else if (ticks > 0) {
        this.zoomIn(ticks);
      } else {
        return;
      }
    }
  
    PDFViewerApplication._centerAtPos(
      previousScale,
      (page0X + page1X) / 2,
      (page0Y + page1Y) / 2
    );
  }

  webViewerTouchEnd(evt: any) {
    if (!PDFViewerApplication._touchInfo) {
      return;
    }
  
    evt.preventDefault();
    PDFViewerApplication._touchInfo = null;
    PDFViewerApplication._touchUnusedTicks = 0;
    PDFViewerApplication._touchUnusedFactor = 1;
  }
}


