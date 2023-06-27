import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import {from, Subscription,} from 'rxjs';
import {ZoomService} from './zoom.service';


@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
  @ViewChild('canvasWrapper') private canvasWrapper: ElementRef | undefined;
  @ViewChild('canvasContent') private canvasContent: ElementRef | undefined;
  @ViewChild('touchArea') private touchArea: ElementRef | undefined;
  title = 'pdf-viewer';
  loading = false;
  subscriptions: Subscription = new Subscription();
  pdfjs;
  zoomScale = 1;
  error: any;

  pdfUrl = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

  constructor(
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
    private renderer: Renderer2,
    private zoomService: ZoomService
  ) {
    this.pdfjs = pdfjs;
  }

  ngOnInit(): void {
    this.pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.7.107/build/pdf.worker.js';


    this.loadPdf(this.pdfUrl);
  }

  createCanvas() {
    const el = this.renderer.createElement('canvas');
    this.renderer.appendChild(this.canvasWrapper?.nativeElement, el);
    return el;
  }

  loadPdf(url: string) {
    this.loading = true;
    this.ngZone.runOutsideAngular(() => {
      const loadingTask = this.pdfjs.getDocument(url);
      const pdfLoad = from(loadingTask.promise);

      let numPagesLoaded = 0;
      let totalPages = 0;
      const subscriptions = new Subscription();

      subscriptions.add(
        pdfLoad.subscribe({
          next: (pdf) => {
            totalPages = pdf.numPages;

            for (let i = 1; i <= pdf.numPages; i++) {
              pdf.getPage(i).then((page) => {
                const viewport = page.getViewport({scale: 1.5});
                const canvas = this.createCanvas();
                const context = canvas.getContext('2d');

                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.width = `calc(var(--scale-factor) * ${canvas.offsetWidth}px)`;
                canvas.style.height = `calc(var(--scale-factor) * ${canvas.offsetHeight}px)`;

                page.render({canvasContext: context, viewport});

                numPagesLoaded++;

                if (numPagesLoaded === totalPages) {
                  this.loading = false;
                  this.cd.detectChanges();

                  this.zoomService.init(
                    this.canvasContent?.nativeElement,
                    this.canvasWrapper?.nativeElement
                  );
                }
              });
            }
          },
          error: (error) => {
            console.error(error);
          },
        })
      );

      this.subscriptions.add(subscriptions);
    });
  }
}