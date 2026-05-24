import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { PhysicsService } from '../../services/physics.service';
import {
  BOARD,
  COLORS,
  GamePhase,
  CoinType,
  Position,
  BotDifficulty,
} from '../../models/game.models';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() difficulty: BotDifficulty = BotDifficulty.MEDIUM;
  @Output() backToMenu = new EventEmitter<void>();

  private ctx!: CanvasRenderingContext2D;
  private animFrameId = 0;
  private lastTime = 0;

  private isDragging = false;
  private dragStart: Position | null = null;
  private dragCurrent: Position | null = null;
  private isPlacingStriker = false;

  private aimAngle = 0;
  private aimPower = 0;

  constructor(
    private gameEngine: GameEngineService,
    private physics: PhysicsService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = BOARD.CANVAS_SIZE;
    canvas.height = BOARD.CANVAS_SIZE;
    this.ctx = canvas.getContext('2d')!;

    this.gameEngine.startGame(this.difficulty);

    this.ngZone.runOutsideAngular(() => {
      this.lastTime = performance.now();
      this.gameLoop();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  onBackToMenu(): void {
    cancelAnimationFrame(this.animFrameId);
    this.gameEngine.resetGame();
    this.backToMenu.emit();
  }

  onRestart(): void {
    this.gameEngine.startGame(this.difficulty);
  }

  private gameLoop(): void {
    const now = performance.now();
    const delta = Math.min(now - this.lastTime, 33);
    this.lastTime = now;

    this.gameEngine.updatePhysics(delta);
    this.render();

    this.animFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /* ---------- Input ---------- */

  onMouseDown(event: MouseEvent): void {
    const pos = this.canvasPos(event);
    const phase = this.gameEngine.currentPhase;

    if (phase === GamePhase.PLACING_STRIKER) {
      this.isPlacingStriker = true;
      this.gameEngine.placeStriker(pos.x);
      return;
    }

    if (phase === GamePhase.AIMING) {
      const sp = this.physics.getStrikerPosition();
      if (!sp) return;
      if (Math.hypot(pos.x - sp.x, pos.y - sp.y) < BOARD.STRIKER_RADIUS * 3) {
        this.isDragging = true;
        this.dragStart = { ...pos };
        this.dragCurrent = { ...pos };
      }
    }
  }

  onMouseMove(event: MouseEvent): void {
    const pos = this.canvasPos(event);
    if (
      this.gameEngine.currentPhase === GamePhase.PLACING_STRIKER &&
      this.isPlacingStriker
    ) {
      this.gameEngine.moveStrikerOnBaseline(pos.x);
      return;
    }

    if (this.isDragging) {
      this.dragCurrent = { ...pos };
      const sp = this.physics.getStrikerPosition();
      if (sp) {
        const dx = this.dragCurrent.x - sp.x;
        const dy = this.dragCurrent.y - sp.y;
        this.aimAngle = Math.atan2(-dy, -dx);
        this.aimPower = Math.min(1, Math.hypot(dx, dy) / BOARD.MAX_DRAG_DISTANCE);
      }
    }
  }

  onMouseUp(_event: MouseEvent): void {
    if (this.isPlacingStriker) {
      this.isPlacingStriker = false;
      return;
    }
    if (this.isDragging) {
      if (this.aimPower > 0.05) {
        this.ngZone.run(() =>
          this.gameEngine.executeShot(this.aimAngle, this.aimPower)
        );
      }
      this.isDragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      this.aimPower = 0;
    }
  }

  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const t = event.touches[0];
    if (t)
      this.onMouseDown({
        clientX: t.clientX,
        clientY: t.clientY,
      } as MouseEvent);
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const t = event.touches[0];
    if (t)
      this.onMouseMove({
        clientX: t.clientX,
        clientY: t.clientY,
      } as MouseEvent);
  }

  onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.onMouseUp({} as MouseEvent);
  }

  private canvasPos(event: MouseEvent): Position {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (BOARD.CANVAS_SIZE / rect.width),
      y: (event.clientY - rect.top) * (BOARD.CANVAS_SIZE / rect.height),
    };
  }

  /* ---------- Rendering ---------- */

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, BOARD.CANVAS_SIZE, BOARD.CANVAS_SIZE);
    this.drawBoard(ctx);
    this.drawCoins(ctx);
    this.drawStriker(ctx);
    this.drawAimLine(ctx);
    this.drawUI(ctx);
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    const cs = BOARD.CANVAS_SIZE;
    const bs = BOARD.BOARD_START;
    const be = BOARD.BOARD_END;

    ctx.fillStyle = '#2C1810';
    ctx.fillRect(0, 0, cs, cs);

    ctx.fillStyle = COLORS.FRAME;
    ctx.fillRect(10, 10, cs - 20, cs - 20);

    ctx.fillStyle = COLORS.FRAME_INNER;
    ctx.fillRect(25, 25, cs - 50, cs - 50);

    ctx.fillStyle = COLORS.SURFACE;
    ctx.fillRect(bs, bs, be - bs, be - bs);

    ctx.fillStyle = COLORS.SURFACE_DARK;
    for (let i = bs; i < be; i += 8) {
      ctx.globalAlpha = 0.03;
      ctx.fillRect(i, bs, 4, be - bs);
    }
    ctx.globalAlpha = 1;

    this.drawMarkings(ctx);
    this.drawPockets(ctx);
    this.drawBaselines(ctx);
  }

  private drawMarkings(ctx: CanvasRenderingContext2D): void {
    const bs = BOARD.BOARD_START;
    const be = BOARD.BOARD_END;
    const c = BOARD.CENTER;

    ctx.strokeStyle = COLORS.LINE;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(c, c, 38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, c, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.LINE;
    ctx.fill();

    const io = 45;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bs + io, bs + io, be - bs - 2 * io, be - bs - 2 * io);

    ctx.lineWidth = 1;
    const d = 30;
    const lines: [number, number, number, number][] = [
      [bs + d, bs + d, bs + d + 45, bs + d + 45],
      [be - d, bs + d, be - d - 45, bs + d + 45],
      [bs + d, be - d, bs + d + 45, be - d - 45],
      [be - d, be - d, be - d - 45, be - d - 45],
    ];
    for (const [x1, y1, x2, y2] of lines) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const cd = 70;
    const cr = 15;
    for (const [cx, cy] of [
      [bs + cd, bs + cd],
      [be - cd, bs + cd],
      [bs + cd, be - cd],
      [be - cd, be - cd],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPockets(ctx: CanvasRenderingContext2D): void {
    for (const p of this.physics.pockets) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, BOARD.POCKET_RADIUS + 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.POCKET_RIM;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, BOARD.POCKET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.POCKET;
      ctx.fill();
    }
  }

  private drawBaselines(ctx: CanvasRenderingContext2D): void {
    const bs = BOARD.BOARD_START;
    const be = BOARD.BOARD_END;
    const bo = BOARD.BASELINE_OFFSET;

    ctx.strokeStyle = COLORS.LINE;
    ctx.lineWidth = 1.5;

    for (const y of [be - bo, bs + bo]) {
      ctx.beginPath();
      ctx.moveTo(bs + bo, y);
      ctx.lineTo(be - bo, y);
      ctx.stroke();
      for (const x of [bs + bo, be - bo]) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const phase = this.gameEngine.currentPhase;
    if (
      phase === GamePhase.PLACING_STRIKER ||
      phase === GamePhase.AIMING
    ) {
      const activeY = this.gameEngine.getStrikerBaselineY();
      ctx.strokeStyle = 'rgba(255,165,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bs + bo, activeY);
      ctx.lineTo(be - bo, activeY);
      ctx.stroke();
    }
  }

  private drawCoins(ctx: CanvasRenderingContext2D): void {
    for (const coin of this.gameEngine.allCoins) {
      if (coin.pocketed) continue;
      const pos = this.physics.getCoinPosition(coin.id);
      if (pos) this.drawCoin(ctx, pos, coin.type);
    }
  }

  private drawCoin(
    ctx: CanvasRenderingContext2D,
    pos: Position,
    type: CoinType
  ): void {
    const r = BOARD.COIN_RADIUS;
    let fill: string;
    let stroke: string;
    let inner: string;

    if (type === CoinType.WHITE) {
      fill = COLORS.COIN_WHITE;
      stroke = COLORS.COIN_WHITE_STROKE;
      inner = '#FFFFFF';
    } else if (type === CoinType.BLACK) {
      fill = COLORS.COIN_BLACK;
      stroke = COLORS.COIN_BLACK_STROKE;
      inner = '#3A3A3A';
    } else {
      fill = COLORS.QUEEN;
      stroke = COLORS.QUEEN_STROKE;
      inner = '#FF2222';
    }

    ctx.beginPath();
    ctx.arc(pos.x + 2, pos.y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    const g = ctx.createRadialGradient(
      pos.x - 3,
      pos.y - 3,
      1,
      pos.x,
      pos.y,
      r
    );
    g.addColorStop(0, inner);
    g.addColorStop(1, fill);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawStriker(ctx: CanvasRenderingContext2D): void {
    const pos = this.physics.getStrikerPosition();
    if (!pos) return;
    const r = BOARD.STRIKER_RADIUS;

    ctx.beginPath();
    ctx.arc(pos.x + 2, pos.y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    const g = ctx.createRadialGradient(
      pos.x - 4,
      pos.y - 4,
      2,
      pos.x,
      pos.y,
      r
    );
    g.addColorStop(0, '#D0D0D0');
    g.addColorStop(0.5, COLORS.STRIKER);
    g.addColorStop(1, '#707070');

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.STRIKER_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.STRIKER_STROKE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawAimLine(ctx: CanvasRenderingContext2D): void {
    if (!this.isDragging || this.aimPower < 0.05) return;
    const sp = this.physics.getStrikerPosition();
    if (!sp) return;

    const lineLen = 100 + this.aimPower * 200;
    const endX = sp.x + Math.cos(this.aimAngle) * lineLen;
    const endY = sp.y + Math.sin(this.aimAngle) * lineLen;

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = COLORS.AIM_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    const hl = 12;
    const ha = 0.4;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - hl * Math.cos(this.aimAngle - ha),
      endY - hl * Math.sin(this.aimAngle - ha)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - hl * Math.cos(this.aimAngle + ha),
      endY - hl * Math.sin(this.aimAngle + ha)
    );
    ctx.strokeStyle = COLORS.AIM_LINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.dragCurrent) {
      const powerColor =
        this.aimPower < 0.33
          ? COLORS.POWER_LOW
          : this.aimPower < 0.66
            ? COLORS.POWER_MED
            : COLORS.POWER_HIGH;

      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = powerColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(this.dragCurrent.x, this.dragCurrent.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = powerColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.round(this.aimPower * 100)}%`,
        (sp.x + this.dragCurrent.x) / 2,
        (sp.y + this.dragCurrent.y) / 2 - 10
      );
    }
  }

  private drawUI(ctx: CanvasRenderingContext2D): void {
    const scores = this.gameEngine.scores;
    const cs = BOARD.CANVAS_SIZE;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.roundRect(ctx, cs / 2 - 130, 2, 260, 36, 6);
    ctx.fill();

    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLORS.COIN_WHITE;
    ctx.fillText(`You: ${scores.player}`, cs / 2 - 55, 20);

    ctx.fillStyle = '#888';
    ctx.fillText(`Bot: ${scores.bot}`, cs / 2 + 60, 20);

    ctx.fillStyle =
      this.gameEngine.turn === 'player' ? '#00FF00' : '#FF4444';
    ctx.beginPath();
    ctx.arc(cs / 2, 20, 4, 0, Math.PI * 2);
    ctx.fill();

    const msg = this.gameEngine.currentMessage;
    if (msg) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.roundRect(ctx, cs / 2 - 190, cs - 40, 380, 34, 8);
      ctx.fill();

      ctx.fillStyle = '#FFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, cs / 2, cs - 23);
    }

    if (this.gameEngine.currentPhase === GamePhase.GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, cs, cs);

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', cs / 2, cs / 2 - 30);

      ctx.font = '22px Arial';
      const winner =
        scores.player >= scores.bot ? 'You Win!' : 'Bot Wins!';
      ctx.fillText(
        `${winner}  ${scores.player} — ${scores.bot}`,
        cs / 2,
        cs / 2 + 15
      );

      ctx.font = '16px Arial';
      ctx.fillStyle = '#CCC';
      ctx.fillText('Click "Restart" to play again', cs / 2, cs / 2 + 55);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
