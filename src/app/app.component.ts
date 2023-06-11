import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { finalize, from, Subscription } from 'rxjs';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent implements OnInit {
  @ViewChild('canvasWrapper') private canvasWrapper: ElementRef | undefined;
  @ViewChild('viewerContainer') private viewerContainer: ElementRef | undefined;
  @ViewChild('touchArea') private touchArea: ElementRef | undefined;
  title = 'pdf-viewer';
  loading = false;
  subscriptions: Subscription = new Subscription();
  pdfjs;
  zoomScale = 1;

  constructor(
    private cd: ChangeDetectorRef,
    private renderer: Renderer2,
  ) {
    this.pdfjs = pdfjs;
    this.pdfjs.GlobalWorkerOptions.workerSrc = `./workers/pdf.worker.js?v${Date.now()}`;
  }

  ngAfterViewInit() {
    const el = this.viewerContainer?.nativeElement;
    const canvasWrap = this.canvasWrapper?.nativeElement;
  }
  ngOnInit(): void {
    this.loadPdf('assets/file-example_PDF_500_kB.pdf');
  }

  createCanvas() {
    const el = this.renderer.createElement('canvas');
    this.renderer.appendChild(this.canvasWrapper?.nativeElement, el);
    return el;
  }

  loadPdf(url: string) {
    this.loading = true;
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
            const pageLoad = from(pdf.getPage(i));
            subscriptions.add(
              pageLoad.subscribe({
                next: (page) => {
                  const viewport = page.getViewport({ scale: 3 });
                  const canvas = this.createCanvas();
                  const context = canvas.getContext('2d');

                  canvas.height = viewport.height;
                  canvas.width = viewport.width;

                  page.render({ canvasContext: context, viewport });
                  numPagesLoaded++;

                  if (numPagesLoaded === totalPages) {
                    this.loading = false;
                    this.cd.detectChanges();
                  }
                },
                error: (error) => {
                  console.error(error);
                },
              })
            );
          }
        },
        error: (error) => {
          console.error(error);
        },
      })
    );

    this.subscriptions.add(subscriptions);
  }
}