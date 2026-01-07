import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tree',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './tree-dialog.html',
  styleUrl: './tree-dialog.scss'
})
export class TreeDialogComponent implements OnInit {

    constructor() {

    }
    ngOnInit(): void {
        
    }
}