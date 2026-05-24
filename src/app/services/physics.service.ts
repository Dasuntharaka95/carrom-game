import { Injectable } from '@angular/core';
import Matter from 'matter-js';
import { BOARD, Position } from '../models/game.models';

@Injectable({ providedIn: 'root' })
export class PhysicsService {
  private engine!: Matter.Engine;
  private coinBodies = new Map<string, Matter.Body>();
  private strikerBody: Matter.Body | null = null;
  private walls: Matter.Body[] = [];
  private pocketPositions: Position[] = [];
  private recentlyPocketed: string[] = [];
  private strikerWasPocketed = false;

  get pockets(): Position[] {
    return this.pocketPositions;
  }

  init(): void {
    this.coinBodies.clear();
    this.strikerBody = null;
    this.recentlyPocketed = [];
    this.strikerWasPocketed = false;

    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });

    this.initPockets();
    this.initWalls();
  }

  private initPockets(): void {
    const s = BOARD.BOARD_START;
    const e = BOARD.BOARD_END;
    const off = 3;
    this.pocketPositions = [
      { x: s + off, y: s + off },
      { x: e - off, y: s + off },
      { x: s + off, y: e - off },
      { x: e - off, y: e - off },
    ];
  }

  private initWalls(): void {
    const s = BOARD.BOARD_START;
    const e = BOARD.BOARD_END;
    const c = BOARD.CENTER;
    const gap = BOARD.POCKET_RADIUS * 2.5;
    const len = e - s - 2 * gap;
    const wt = BOARD.WALL_THICKNESS;
    const opts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      restitution: BOARD.WALL_RESTITUTION,
      friction: 0.05,
    };

    this.walls = [
      Matter.Bodies.rectangle(c, s - wt / 2, len, wt, opts),
      Matter.Bodies.rectangle(c, e + wt / 2, len, wt, opts),
      Matter.Bodies.rectangle(s - wt / 2, c, wt, len, opts),
      Matter.Bodies.rectangle(e + wt / 2, c, wt, len, opts),
    ];

    Matter.Composite.add(this.engine.world, this.walls);
  }

  addCoin(id: string, pos: Position): void {
    const body = Matter.Bodies.circle(pos.x, pos.y, BOARD.COIN_RADIUS, {
      restitution: BOARD.RESTITUTION,
      friction: BOARD.FRICTION,
      frictionAir: BOARD.AIR_FRICTION,
      density: BOARD.DENSITY,
      label: id,
    });
    this.coinBodies.set(id, body);
    Matter.Composite.add(this.engine.world, body);
  }

  placeStriker(pos: Position): void {
    this.removeStriker();
    this.strikerWasPocketed = false;
    this.strikerBody = Matter.Bodies.circle(pos.x, pos.y, BOARD.STRIKER_RADIUS, {
      restitution: BOARD.RESTITUTION,
      friction: BOARD.FRICTION,
      frictionAir: BOARD.AIR_FRICTION + 0.005,
      density: BOARD.STRIKER_DENSITY,
      label: 'striker',
    });
    Matter.Composite.add(this.engine.world, this.strikerBody);
  }

  moveStriker(x: number): void {
    if (!this.strikerBody) return;
    const minX = BOARD.BOARD_START + BOARD.BASELINE_OFFSET;
    const maxX = BOARD.BOARD_END - BOARD.BASELINE_OFFSET;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    Matter.Body.setPosition(this.strikerBody, {
      x: clampedX,
      y: this.strikerBody.position.y,
    });
    Matter.Body.setVelocity(this.strikerBody, { x: 0, y: 0 });
  }

  shoot(angle: number, power: number): void {
    if (!this.strikerBody) return;
    const forceMag = power * BOARD.MAX_SHOT_POWER;
    Matter.Body.applyForce(this.strikerBody, this.strikerBody.position, {
      x: Math.cos(angle) * forceMag,
      y: Math.sin(angle) * forceMag,
    });
  }

  update(delta: number): void {
    Matter.Engine.update(this.engine, delta);
    this.checkPockets();
    this.applyPocketAttraction();
  }

  private checkPockets(): void {
    const threshold = BOARD.POCKET_RADIUS * 1.1;

    const toRemove: string[] = [];
    this.coinBodies.forEach((body, id) => {
      for (const pocket of this.pocketPositions) {
        if (this.dist(body.position, pocket) < threshold) {
          toRemove.push(id);
          break;
        }
      }
    });

    for (const id of toRemove) {
      const body = this.coinBodies.get(id);
      if (body) {
        Matter.Composite.remove(this.engine.world, body);
        this.coinBodies.delete(id);
        this.recentlyPocketed.push(id);
      }
    }

    if (this.strikerBody && !this.strikerWasPocketed) {
      for (const pocket of this.pocketPositions) {
        if (this.dist(this.strikerBody.position, pocket) < threshold) {
          this.strikerWasPocketed = true;
          Matter.Composite.remove(this.engine.world, this.strikerBody);
          this.strikerBody = null;
          break;
        }
      }
    }
  }

  private applyPocketAttraction(): void {
    const range = BOARD.POCKET_RADIUS * 2.5;
    const strength = 0.000005;

    const applyToBody = (body: Matter.Body): void => {
      for (const pocket of this.pocketPositions) {
        const dx = pocket.x - body.position.x;
        const dy = pocket.y - body.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < range && d > 3) {
          const factor = strength * (1 - d / range);
          Matter.Body.applyForce(body, body.position, {
            x: dx * factor,
            y: dy * factor,
          });
        }
      }
    };

    this.coinBodies.forEach((body) => applyToBody(body));
    if (this.strikerBody) applyToBody(this.strikerBody);
  }

  isSettled(): boolean {
    const threshold = BOARD.SETTLE_SPEED;
    for (const body of this.coinBodies.values()) {
      if (body.speed > threshold) return false;
    }
    if (this.strikerBody && this.strikerBody.speed > threshold) return false;
    return true;
  }

  flushPocketed(): { coinIds: string[]; strikerPocketed: boolean } {
    const result = {
      coinIds: [...this.recentlyPocketed],
      strikerPocketed: this.strikerWasPocketed,
    };
    this.recentlyPocketed = [];
    this.strikerWasPocketed = false;
    return result;
  }

  getCoinPosition(id: string): Position | null {
    const body = this.coinBodies.get(id);
    return body ? { x: body.position.x, y: body.position.y } : null;
  }

  getStrikerPosition(): Position | null {
    if (!this.strikerBody) return null;
    return { x: this.strikerBody.position.x, y: this.strikerBody.position.y };
  }

  getAllCoinPositions(): Map<string, Position> {
    const map = new Map<string, Position>();
    this.coinBodies.forEach((body, id) => {
      map.set(id, { x: body.position.x, y: body.position.y });
    });
    return map;
  }

  removeStriker(): void {
    if (this.strikerBody) {
      Matter.Composite.remove(this.engine.world, this.strikerBody);
      this.strikerBody = null;
    }
  }

  destroy(): void {
    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
    this.coinBodies.clear();
    this.strikerBody = null;
    this.recentlyPocketed = [];
    this.strikerWasPocketed = false;
  }

  private dist(a: Matter.Vector, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
