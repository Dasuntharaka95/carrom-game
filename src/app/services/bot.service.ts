import { Injectable } from '@angular/core';
import { BotDifficulty, CoinType, Position, BOARD } from '../models/game.models';

export interface BotMove {
  strikerX: number;
  angle: number;
  power: number;
}

@Injectable({ providedIn: 'root' })
export class BotService {
  computeMove(
    coins: Map<string, { pos: Position; type: CoinType }>,
    baselineY: number,
    difficulty: BotDifficulty,
    pockets: Position[]
  ): BotMove {
    switch (difficulty) {
      case BotDifficulty.EASY:
        return this.easyMove(coins, baselineY);
      case BotDifficulty.MEDIUM:
        return this.mediumMove(coins, baselineY, pockets);
      case BotDifficulty.HARD:
        return this.hardMove(coins, baselineY, pockets);
      default:
        return this.easyMove(coins, baselineY);
    }
  }

  private easyMove(
    coins: Map<string, { pos: Position; type: CoinType }>,
    baselineY: number
  ): BotMove {
    const minX = BOARD.BOARD_START + BOARD.BASELINE_OFFSET;
    const maxX = BOARD.BOARD_END - BOARD.BASELINE_OFFSET;
    const strikerX = minX + Math.random() * (maxX - minX);

    const ownCoins: Position[] = [];
    coins.forEach(({ pos, type }) => {
      if (type === CoinType.BLACK) ownCoins.push(pos);
    });

    const target =
      ownCoins.length > 0
        ? ownCoins[Math.floor(Math.random() * ownCoins.length)]
        : { x: BOARD.CENTER, y: BOARD.CENTER };

    const angle = Math.atan2(target.y - baselineY, target.x - strikerX);
    const power = 0.3 + Math.random() * 0.4;

    return { strikerX, angle, power };
  }

  private mediumMove(
    coins: Map<string, { pos: Position; type: CoinType }>,
    baselineY: number,
    pockets: Position[]
  ): BotMove {
    let bestScore = -Infinity;
    let bestMove: BotMove | null = null;

    const ownCoins: { id: string; pos: Position }[] = [];
    coins.forEach(({ pos, type }, id) => {
      if (type === CoinType.BLACK || type === CoinType.QUEEN) {
        ownCoins.push({ id, pos });
      }
    });

    const minX = BOARD.BOARD_START + BOARD.BASELINE_OFFSET;
    const maxX = BOARD.BOARD_END - BOARD.BASELINE_OFFSET;

    for (const coin of ownCoins) {
      for (const pocket of pockets) {
        const c2p = { x: pocket.x - coin.pos.x, y: pocket.y - coin.pos.y };
        const c2pDist = Math.sqrt(c2p.x * c2p.x + c2p.y * c2p.y);
        if (c2pDist < 10) continue;

        const hitPoint = {
          x:
            coin.pos.x -
            (c2p.x / c2pDist) * (BOARD.COIN_RADIUS + BOARD.STRIKER_RADIUS),
          y:
            coin.pos.y -
            (c2p.y / c2pDist) * (BOARD.COIN_RADIUS + BOARD.STRIKER_RADIUS),
        };

        const strikerX = Math.max(minX, Math.min(maxX, hitPoint.x));
        const strikerPos = { x: strikerX, y: baselineY };

        const angle = Math.atan2(
          hitPoint.y - strikerPos.y,
          hitPoint.x - strikerPos.x
        );
        const dist = Math.sqrt(
          (hitPoint.x - strikerPos.x) ** 2 + (hitPoint.y - strikerPos.y) ** 2
        );
        const power = Math.min(0.85, Math.max(0.3, dist / 400));

        const s2h = {
          x: hitPoint.x - strikerPos.x,
          y: hitPoint.y - strikerPos.y,
        };
        const s2hDist = Math.sqrt(s2h.x * s2h.x + s2h.y * s2h.y);

        const alignment =
          s2hDist > 0 && c2pDist > 0
            ? (s2h.x * c2p.x + s2h.y * c2p.y) / (s2hDist * c2pDist)
            : 0;

        const score =
          alignment * 100 -
          c2pDist * 0.1 -
          s2hDist * 0.05 +
          (Math.random() - 0.5) * 20;

        if (score > bestScore) {
          bestScore = score;
          bestMove = { strikerX, angle, power };
        }
      }
    }

    return bestMove ?? this.easyMove(coins, baselineY);
  }

  private hardMove(
    coins: Map<string, { pos: Position; type: CoinType }>,
    baselineY: number,
    pockets: Position[]
  ): BotMove {
    let bestScore = -Infinity;
    let bestMove: BotMove | null = null;

    const ownCoins: { id: string; pos: Position; type: CoinType }[] = [];
    const opponentCoins: Position[] = [];

    coins.forEach(({ pos, type }, id) => {
      if (type === CoinType.BLACK || type === CoinType.QUEEN) {
        ownCoins.push({ id, pos, type });
      }
      if (type === CoinType.WHITE) {
        opponentCoins.push(pos);
      }
    });

    const minX = BOARD.BOARD_START + BOARD.BASELINE_OFFSET;
    const maxX = BOARD.BOARD_END - BOARD.BASELINE_OFFSET;

    for (const coin of ownCoins) {
      for (const pocket of pockets) {
        const c2p = { x: pocket.x - coin.pos.x, y: pocket.y - coin.pos.y };
        const c2pDist = Math.sqrt(c2p.x * c2p.x + c2p.y * c2p.y);
        if (c2pDist < 10) continue;

        const hitPoint = {
          x:
            coin.pos.x -
            (c2p.x / c2pDist) * (BOARD.COIN_RADIUS + BOARD.STRIKER_RADIUS),
          y:
            coin.pos.y -
            (c2p.y / c2pDist) * (BOARD.COIN_RADIUS + BOARD.STRIKER_RADIUS),
        };

        for (let offset = -50; offset <= 50; offset += 25) {
          const strikerX = Math.max(minX, Math.min(maxX, hitPoint.x + offset));
          const strikerPos = { x: strikerX, y: baselineY };

          const angle = Math.atan2(
            hitPoint.y - strikerPos.y,
            hitPoint.x - strikerPos.x
          );
          const dist = Math.sqrt(
            (hitPoint.x - strikerPos.x) ** 2 +
              (hitPoint.y - strikerPos.y) ** 2
          );
          const power = Math.min(0.9, Math.max(0.25, dist / 350));

          const s2h = {
            x: hitPoint.x - strikerPos.x,
            y: hitPoint.y - strikerPos.y,
          };
          const s2hDist = Math.sqrt(s2h.x * s2h.x + s2h.y * s2h.y);

          const alignment =
            s2hDist > 0 && c2pDist > 0
              ? (s2h.x * c2p.x + s2h.y * c2p.y) / (s2hDist * c2pDist)
              : 0;

          let blocked = false;
          for (const opp of opponentCoins) {
            const distToLine = this.pointToLineDist(opp, strikerPos, hitPoint);
            if (
              distToLine < BOARD.COIN_RADIUS * 2 &&
              this.isBetween(opp, strikerPos, hitPoint)
            ) {
              blocked = true;
              break;
            }
          }

          let score = alignment * 150 - c2pDist * 0.15;
          if (blocked) score -= 80;
          if (coin.type === CoinType.QUEEN) score += 30;
          score += (Math.random() - 0.5) * 5;

          if (score > bestScore) {
            bestScore = score;
            bestMove = { strikerX, angle, power };
          }
        }
      }
    }

    return bestMove ?? this.mediumMove(coins, baselineY, pockets);
  }

  private pointToLineDist(
    point: Position,
    lineStart: Position,
    lineEnd: Position
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0)
      return Math.sqrt(
        (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
      );

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len2
      )
    );
    const cx = lineStart.x + t * dx;
    const cy = lineStart.y + t * dy;
    return Math.sqrt((point.x - cx) ** 2 + (point.y - cy) ** 2);
  }

  private isBetween(
    point: Position,
    start: Position,
    end: Position
  ): boolean {
    const d1 = Math.sqrt(
      (point.x - start.x) ** 2 + (point.y - start.y) ** 2
    );
    const d2 = Math.sqrt((point.x - end.x) ** 2 + (point.y - end.y) ** 2);
    const lineLen = Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2
    );
    return d1 < lineLen && d2 < lineLen;
  }
}
