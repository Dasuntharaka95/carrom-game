import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotDifficulty } from '../../models/game.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  @Output() startGame = new EventEmitter<BotDifficulty>();

  selectedDifficulty: BotDifficulty = BotDifficulty.MEDIUM;
  difficulties = [
    { value: BotDifficulty.EASY, label: 'Easy', icon: '🟢', desc: 'Random shots — good for learning' },
    { value: BotDifficulty.MEDIUM, label: 'Medium', icon: '🟡', desc: 'Aims at pockets — a fair challenge' },
    { value: BotDifficulty.HARD, label: 'Hard', icon: '🔴', desc: 'Strategic play — watch out!' },
  ];

  selectDifficulty(d: BotDifficulty): void {
    this.selectedDifficulty = d;
  }

  play(): void {
    this.startGame.emit(this.selectedDifficulty);
  }
}
