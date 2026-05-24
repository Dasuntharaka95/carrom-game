import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BoardComponent } from './components/board/board.component';
import { MenuComponent } from './components/menu/menu.component';
import { BotDifficulty } from './models/game.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BoardComponent, MenuComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  showGame = false;
  difficulty: BotDifficulty = BotDifficulty.MEDIUM;

  onStartGame(d: BotDifficulty): void {
    this.difficulty = d;
    this.showGame = true;
  }

  onBackToMenu(): void {
    this.showGame = false;
  }
}
