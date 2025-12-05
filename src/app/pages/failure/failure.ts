import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-failure',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './failure.html',
  styleUrl: './failure.scss'
})
export class FailureComponent {}
