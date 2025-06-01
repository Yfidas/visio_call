import { Routes } from '@angular/router';
import { CallComponent } from './call/call.component';

export const routes: Routes = [
    { path: '', redirectTo: 'call', pathMatch: 'full' },
    { path: 'call', component: CallComponent },
];
