import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { ZoomService } from './zoom.service';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [ZoomService],
  bootstrap: [AppComponent],
})
export class AppModule {}