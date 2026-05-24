import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  GamePhase,
  CoinType,
  CoinState,
  Position,
  BotDifficulty,
  BOARD,
} from '../models/game.models';
import { PhysicsService } from './physics.service';
import { BotService } from './bot.service';

@Injectable({ providedIn: 'root' })
export class GameEngineService {
  private phase$ = new BehaviorSubject<GamePhase>(GamePhase.MENU);
  private message$ = new BehaviorSubject<string>('');
  private coins: CoinState[] = [];
  private currentTurn: 'player' | 'bot' = 'player';
  private playerScore = 0;
  private botScore = 0;
  private botDifficulty = BotDifficulty.MEDIUM;
  private shootTime = 0;

  readonly phase = this.phase$.asObservable();
  readonly message = this.message$.asObservable();

  get currentPhase(): GamePhase {
    return this.phase$.value;
  }
  get turn(): 'player' | 'bot' {
    return this.currentTurn;
  }
  get scores(): { player: number; bot: number } {
    return { player: this.playerScore, bot: this.botScore };
  }
  get allCoins(): CoinState[] {
    return this.coins;
  }
  get currentMessage(): string {
    return this.message$.value;
  }

  constructor(
    private physics: PhysicsService,
    private bot: BotService
  ) {}

  startGame(difficulty: BotDifficulty): void {
    this.botDifficulty = difficulty;
    this.playerScore = 0;
    this.botScore = 0;
    this.currentTurn = 'player';
    this.coins = [];

    this.physics.destroy();
    this.physics.init();
    this.setupCoins();

    this.setPhase(GamePhase.PLACING_STRIKER);
    this.showMessage('Place your striker on the baseline');
  }

  private setupCoins(): void {
    const cx = BOARD.CENTER;
    const cy = BOARD.CENTER;

    this.addCoin('queen', CoinType.QUEEN, cx, cy);

    const innerRadius = 28;
    const innerTypes = [
      CoinType.WHITE,
      CoinType.BLACK,
      CoinType.WHITE,
      CoinType.BLACK,
      CoinType.WHITE,
      CoinType.BLACK,
    ];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180;
      this.addCoin(
        `${innerTypes[i].toLowerCase()}_${i}`,
        innerTypes[i],
        cx + Math.cos(angle) * innerRadius,
        cy + Math.sin(angle) * innerRadius
      );
    }

    const outerRadius = 55;
    for (let i = 0; i < 12; i++) {
      const angle = ((i * 30 + 15) * Math.PI) / 180;
      const type = i % 2 === 0 ? CoinType.WHITE : CoinType.BLACK;
      this.addCoin(
        `${type.toLowerCase()}_${i + 6}`,
        type,
        cx + Math.cos(angle) * outerRadius,
        cy + Math.sin(angle) * outerRadius
      );
    }
  }

  private addCoin(id: string, type: CoinType, x: number, y: number): void {
    this.coins.push({ id, type, pocketed: false });
    this.physics.addCoin(id, { x, y });
  }

  getStrikerBaselineY(): number {
    return this.currentTurn === 'player'
      ? BOARD.BOARD_END - BOARD.BASELINE_OFFSET
      : BOARD.BOARD_START + BOARD.BASELINE_OFFSET;
  }

  placeStriker(x: number): void {
    if (this.currentPhase !== GamePhase.PLACING_STRIKER) return;
    this.physics.placeStriker({ x, y: this.getStrikerBaselineY() });
    this.setPhase(GamePhase.AIMING);
    this.showMessage('Drag from striker to aim & shoot');
  }

  moveStrikerOnBaseline(x: number): void {
    if (
      this.currentPhase !== GamePhase.AIMING &&
      this.currentPhase !== GamePhase.PLACING_STRIKER
    )
      return;
    this.physics.moveStriker(x);
  }

  executeShot(angle: number, power: number): void {
    if (this.currentPhase !== GamePhase.AIMING) return;
    if (power < 0.05) return;

    this.physics.shoot(angle, power);
    this.shootTime = Date.now();
    this.setPhase(GamePhase.SHOOTING);
    this.showMessage('');
  }

  updatePhysics(delta: number): void {
    const phase = this.currentPhase;
    if (phase !== GamePhase.SHOOTING && phase !== GamePhase.BOT_SHOOTING)
      return;

    this.physics.update(delta);

    const elapsed = Date.now() - this.shootTime;
    if (
      (this.physics.isSettled() && elapsed > 500) ||
      elapsed > BOARD.SETTLE_TIMEOUT
    ) {
      this.evaluateTurn();
    }
  }

  private evaluateTurn(): void {
    const result = this.physics.flushPocketed();
    this.physics.removeStriker();

    let ownPocketed = 0;
    let opponentPocketed = 0;
    let queenPocketed = false;

    const ownType =
      this.currentTurn === 'player' ? CoinType.WHITE : CoinType.BLACK;

    for (const coinId of result.coinIds) {
      const coin = this.coins.find((c) => c.id === coinId);
      if (!coin) continue;
      coin.pocketed = true;

      if (coin.type === CoinType.QUEEN) {
        queenPocketed = true;
      } else if (coin.type === ownType) {
        ownPocketed++;
      } else {
        opponentPocketed++;
      }
    }

    if (this.currentTurn === 'player') {
      this.playerScore += ownPocketed;
      this.botScore += opponentPocketed;
      if (queenPocketed) this.playerScore += 3;
      if (result.strikerPocketed && this.playerScore > 0) this.playerScore--;
    } else {
      this.botScore += ownPocketed;
      this.playerScore += opponentPocketed;
      if (queenPocketed) this.botScore += 3;
      if (result.strikerPocketed && this.botScore > 0) this.botScore--;
    }

    const whiteLeft = this.coins.filter(
      (c) => c.type === CoinType.WHITE && !c.pocketed
    ).length;
    const blackLeft = this.coins.filter(
      (c) => c.type === CoinType.BLACK && !c.pocketed
    ).length;
    const totalLeft = this.coins.filter((c) => !c.pocketed).length;

    if (whiteLeft === 0 || blackLeft === 0 || totalLeft <= 1) {
      this.setPhase(GamePhase.GAME_OVER);
      const winner =
        this.playerScore >= this.botScore ? 'Player' : 'Bot';
      this.showMessage(
        `Game Over! ${winner} wins! (${this.playerScore} - ${this.botScore})`
      );
      return;
    }

    const bonusTurn = ownPocketed > 0 && !result.strikerPocketed;

    if (!bonusTurn) {
      this.currentTurn = this.currentTurn === 'player' ? 'bot' : 'player';
    }

    if (result.strikerPocketed) {
      this.showMessage('Foul! Striker pocketed.');
    } else if (bonusTurn) {
      this.showMessage(
        this.currentTurn === 'player'
          ? 'Nice shot! Go again!'
          : 'Bot gets another turn'
      );
    }

    if (this.currentTurn === 'bot') {
      this.startBotTurn();
    } else {
      this.setPhase(GamePhase.PLACING_STRIKER);
      if (!bonusTurn && !result.strikerPocketed) {
        this.showMessage('Your turn — place the striker');
      }
    }
  }

  private startBotTurn(): void {
    this.setPhase(GamePhase.BOT_THINKING);
    this.showMessage('Bot is thinking...');

    const baselineY = this.getStrikerBaselineY();
    const active = new Map<string, { pos: Position; type: CoinType }>();

    for (const coin of this.coins) {
      if (coin.pocketed) continue;
      const pos = this.physics.getCoinPosition(coin.id);
      if (pos) active.set(coin.id, { pos, type: coin.type });
    }

    const move = this.bot.computeMove(
      active,
      baselineY,
      this.botDifficulty,
      this.physics.pockets
    );

    setTimeout(() => {
      this.physics.placeStriker({ x: move.strikerX, y: baselineY });

      setTimeout(() => {
        this.physics.shoot(move.angle, move.power);
        this.shootTime = Date.now();
        this.setPhase(GamePhase.BOT_SHOOTING);
        this.showMessage('Bot is shooting...');
      }, 500);
    }, 800);
  }

  private setPhase(phase: GamePhase): void {
    this.phase$.next(phase);
  }

  private showMessage(msg: string): void {
    this.message$.next(msg);
  }

  resetGame(): void {
    this.physics.destroy();
    this.setPhase(GamePhase.MENU);
    this.showMessage('');
  }
}
